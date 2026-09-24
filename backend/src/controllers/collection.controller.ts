import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Collection } from '../models/collection.schema';
import { COLLECTION_ROUTES } from '../routes/collection.routes';
import { CollectionService } from '../services/collection.service';
import { CollaboratorRole } from '../types/enums';
import type {
  AuthUser,
  CollectionAssetBody,
  CollectionCollaboratorBody,
  CollectionRenameBody,
} from '../types/interfaces';
import { ok } from '../utils/response';

@ApiTags('collections')
@Controller(COLLECTION_ROUTES.root)
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get()
  async findAll(@Req() req: Request & { user: AuthUser }) {
    return ok(await this.collectionService.findVisible(req.user.id));
  }

  @Get(COLLECTION_ROUTES.detail)
  async findOne(@Param('id') id: string, @Req() req: Request & { user: AuthUser }) {
    return ok(await this.collectionService.findForRead(id, req.user.id));
  }

  @Post()
  async create(@Body() payload: Partial<Collection>, @Req() req: Request & { user: AuthUser }) {
    return ok(await this.collectionService.create(req.user.id, payload), '收藏夹已创建');
  }

  @Patch(COLLECTION_ROUTES.detail)
  async rename(
    @Param('id') id: string,
    @Body() body: CollectionRenameBody,
    @Req() req: Request & { user: AuthUser },
  ) {
    return ok(await this.collectionService.rename(id, req.user.id, body?.name, body?.revision), '收藏夹已改名');
  }

  @Patch(COLLECTION_ROUTES.addAsset)
  async addAsset(
    @Param('id') id: string,
    @Param('assetId') assetId: string,
    @Body() body: CollectionAssetBody,
    @Req() req: Request & { user: AuthUser },
  ) {
    return ok(await this.collectionService.addAsset(id, assetId, req.user.id, body?.revision), '素材已加入收藏夹');
  }

  @Delete(COLLECTION_ROUTES.removeAsset)
  async removeAsset(
    @Param('id') id: string,
    @Param('assetId') assetId: string,
    @Body() body: CollectionAssetBody,
    @Req() req: Request & { user: AuthUser },
  ) {
    return ok(await this.collectionService.removeAsset(id, assetId, req.user.id, body?.revision), '素材已移出收藏夹');
  }

  @Get(COLLECTION_ROUTES.collaborators)
  async listCollaborators(@Param('id') id: string, @Req() req: Request & { user: AuthUser }) {
    return ok(await this.collectionService.listCollaborators(id, req.user.id));
  }

  @Post(COLLECTION_ROUTES.collaborators)
  async addCollaborator(
    @Param('id') id: string,
    @Body() body: CollectionCollaboratorBody,
    @Req() req: Request & { user: AuthUser },
  ) {
    if (!body?.userId) {
      throw new BadRequestException('协作成员 userId 不能为空');
    }
    const role = body.role === CollaboratorRole.Editor ? CollaboratorRole.Editor : CollaboratorRole.Viewer;
    return ok(
      await this.collectionService.addCollaborator(id, req.user.id, body.userId, role),
      '协作成员已添加',
    );
  }

  @Delete(COLLECTION_ROUTES.collaborator)
  async removeCollaborator(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: Request & { user: AuthUser },
  ) {
    return ok(await this.collectionService.removeCollaborator(id, req.user.id, userId), '协作成员已移除');
  }
}
