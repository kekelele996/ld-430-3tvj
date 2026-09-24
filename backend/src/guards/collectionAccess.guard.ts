import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { CollectionAction, COLLECTION_ACTION_METADATA } from '../decorators/collectionAction.decorator';
import type { CollectionDocument } from '../models/collection.schema';
import { CollectionService } from '../services/collection.service';
import { CollectionCollaboratorRole } from '../types/enums';
import type { AuthenticatedRequest } from '../types/interfaces';

@Injectable()
export class CollectionAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly collectionService: CollectionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.getAllAndOverride<CollectionAction | undefined>(COLLECTION_ACTION_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!action) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('未登录，无法访问收藏夹');
    if (action === CollectionAction.Create) return true;

    const rawId = req.params?.id;
    const collectionId = typeof rawId === 'string' ? rawId : undefined;
    if (!collectionId || !Types.ObjectId.isValid(collectionId)) {
      throw new NotFoundException('收藏夹不存在');
    }
    const collection = await this.collectionService.getByIdOrThrow(collectionId);

    if (this.isAllowed(action, userId, collection)) return true;
    throw new ForbiddenException('无权访问该收藏夹，或协作权限已被移除');
  }

  private isAllowed(action: CollectionAction, userId: string, collection: CollectionDocument): boolean {
    if (collection.creatorId === userId) return true;
    const collaborator = collection.collaborators.find((member) => member.userId === userId);

    if (action === CollectionAction.Read) {
      return collection.isPublic || collaborator != null;
    }
    if (action === CollectionAction.Edit) {
      return collaborator?.role === CollectionCollaboratorRole.Editor;
    }
    // Manage：仅创建者，上面已通过 creatorId 判断
    return false;
  }
}
