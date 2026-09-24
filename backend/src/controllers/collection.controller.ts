import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CollectionAction, CollectionActionRequired } from '../decorators/collectionAction.decorator';
import { CollectionAccessGuard } from '../guards/collectionAccess.guard';
import { Collection } from '../models/collection.schema';
import { COLLECTION_ROUTES } from '../routes/collection.routes';
import { CollectionService, type RevisionConflict } from '../services/collection.service';
import type {
  AuthenticatedRequest,
  CollectionCollaboratorInput,
  CollectionMetaUpdatePayload,
} from '../types/interfaces';
import { ok } from '../utils/response';

@ApiTags('collections')
@Controller(COLLECTION_ROUTES.root)
@UseGuards(CollectionAccessGuard)
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get()
  async findAll(@Req() req: AuthenticatedRequest) {
    return ok(await this.collectionService.findVisible(this.userId(req)));
  }

  @Get(COLLECTION_ROUTES.detail)
  @CollectionActionRequired(CollectionAction.Read)
  async findOne(@Param('id') id: string) {
    return ok(await this.collectionService.getByIdOrThrow(id));
  }

  @Post()
  @CollectionActionRequired(CollectionAction.Create)
  async create(@Req() req: AuthenticatedRequest, @Body() payload: Partial<Collection>) {
    return ok(await this.collectionService.create(this.userId(req), payload), '收藏夹已创建');
  }

  @Patch(COLLECTION_ROUTES.meta)
  @CollectionActionRequired(CollectionAction.Edit)
  async updateMeta(@Param('id') id: string, @Body() payload: CollectionMetaUpdatePayload) {
    const result = await this.collectionService.updateMeta(id, payload);
    this.throwIfConflict(result);
    return ok(result, '收藏夹已更新');
  }

  @Patch(COLLECTION_ROUTES.addAsset)
  @CollectionActionRequired(CollectionAction.Edit)
  async addAsset(@Param('id') id: string, @Param('assetId') assetId: string, @Query('expectedRevision') revision?: string) {
    const result = await this.collectionService.addAsset(id, assetId, this.parseExpectedRevision(revision));
    this.throwIfConflict(result);
    return ok(result, '素材已加入收藏夹');
  }

  @Delete(COLLECTION_ROUTES.addAsset)
  @CollectionActionRequired(CollectionAction.Edit)
  async removeAsset(@Param('id') id: string, @Param('assetId') assetId: string, @Query('expectedRevision') revision?: string) {
    const result = await this.collectionService.removeAsset(id, assetId, this.parseExpectedRevision(revision));
    this.throwIfConflict(result);
    return ok(result, '素材已从收藏夹移除');
  }

  @Post(COLLECTION_ROUTES.collaborators)
  @CollectionActionRequired(CollectionAction.Manage)
  async addCollaborator(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() payload: CollectionCollaboratorInput) {
    return ok(await this.collectionService.addCollaborator(id, this.userId(req), payload), '协作成员已添加');
  }

  @Delete(COLLECTION_ROUTES.collaborator)
  @CollectionActionRequired(CollectionAction.Manage)
  async removeCollaborator(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Param('userId') userId: string) {
    return ok(await this.collectionService.removeCollaborator(id, this.userId(req), userId), '协作成员已移除');
  }

  private userId(req: AuthenticatedRequest): string {
    const id = req.user?.id;
    if (!id) throw new BadRequestException('缺少用户身份');
    return id;
  }

  private parseExpectedRevision(raw: string | undefined): number {
    const value = Number(raw);
    if (!raw || !Number.isInteger(value) || value < 1) {
      throw new BadRequestException('必须提交最后看到的修订号 expectedRevision（正整数）');
    }
    return value;
  }

  /** 冲突时不覆盖对方改动，返回 409 并附上最新修订号与当前名称/素材 */
  private throwIfConflict(result: unknown): asserts result is Collection {
    if (result != null && typeof result === 'object' && (result as RevisionConflict).conflict) {
      const current = (result as RevisionConflict).current;
      throw new ConflictException({
        message: '收藏夹已被他人修改，本次提交未生效，请基于最新版本重试',
        currentRevision: current.revision,
        current: {
          name: current.name,
          assetIds: current.assetIds,
          collaborators: current.collaborators,
        },
      });
    }
  }
}
