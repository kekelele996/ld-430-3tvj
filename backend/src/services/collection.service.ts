import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Collection, type CollectionDocument } from '../models/collection.schema';
import { CollectionCollaboratorRole } from '../types/enums';
import type { CollectionCollaboratorInput, CollectionMetaUpdatePayload } from '../types/interfaces';

export interface RevisionConflict {
  conflict: true;
  current: CollectionDocument;
}

type RevisionUpdateResult = CollectionDocument | RevisionConflict;

@Injectable()
export class CollectionService {
  constructor(@InjectModel(Collection.name) private readonly collectionModel: Model<CollectionDocument>) {}

  /** 当前用户可见：公开收藏夹 + 自己创建/协作的收藏夹 */
  findVisible(userId: string) {
    return this.collectionModel
      .find({
        $or: [{ creatorId: userId }, { isPublic: true }, { 'collaborators.userId': userId }],
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getByIdOrThrow(collectionId: string): Promise<CollectionDocument> {
    if (!Types.ObjectId.isValid(collectionId)) throw new NotFoundException('收藏夹不存在');
    const collection = await this.collectionModel.findById(collectionId).exec();
    if (!collection) throw new NotFoundException('收藏夹不存在');
    return collection;
  }

  async create(creatorId: string, payload: Partial<Collection>) {
    if (!payload.name?.trim()) throw new BadRequestException('收藏夹名称不能为空');
    return this.collectionModel.create({
      name: payload.name.trim(),
      description: payload.description,
      coverUrl: payload.coverUrl,
      isPublic: payload.isPublic ?? false,
      creatorId,
      assetIds: [],
      collaborators: [],
      revision: 1,
    });
  }

  /** 添加协作成员或调整其身份，仅创建者可操作 */
  async addCollaborator(collectionId: string, actorId: string, input: CollectionCollaboratorInput) {
    const collection = await this.getByIdOrThrow(collectionId);
    if (collection.creatorId !== actorId) throw new ForbiddenException('只有收藏夹创建者可以管理协作成员');

    const userId = input?.userId?.trim();
    if (!userId) throw new BadRequestException('协作成员 ID 不能为空');
    if (userId === collection.creatorId) throw new BadRequestException('创建者无需被添加为协作成员');
    if (!input.role || !Object.values(CollectionCollaboratorRole).includes(input.role)) {
      throw new BadRequestException('协作身份必须是 Viewer 或 Editor');
    }

    const existing = collection.collaborators.find((member) => member.userId === userId);
    if (existing) {
      if (existing.role === input.role) return collection;
      return this.collectionModel
        .findOneAndUpdate(
          { _id: collection._id, 'collaborators.userId': userId },
          { $set: { 'collaborators.$.role': input.role } },
          { new: true },
        )
        .exec();
    }

    return this.collectionModel
      .findByIdAndUpdate(
        collection._id,
        { $push: { collaborators: { userId, role: input.role, addedAt: new Date() } } },
        { new: true, runValidators: true },
      )
      .exec();
  }

  /** 移除协作成员，仅创建者可操作；移除后该成员后续请求会被实时鉴权拒绝 */
  async removeCollaborator(collectionId: string, actorId: string, userId: string) {
    const collection = await this.getByIdOrThrow(collectionId);
    if (collection.creatorId !== actorId) throw new ForbiddenException('只有收藏夹创建者可以管理协作成员');
    if (!userId?.trim()) throw new BadRequestException('协作成员 ID 不能为空');
    return this.collectionModel
      .findByIdAndUpdate(collection._id, { $pull: { collaborators: { userId } } }, { new: true })
      .exec();
  }

  /** 改名（description/coverUrl 随同元数据更新），基于修订号的乐观锁 */
  updateMeta(collectionId: string, payload: CollectionMetaUpdatePayload): Promise<RevisionUpdateResult> {
    const expectedRevision = this.parseExpectedRevision(payload.expectedRevision);
    const fields: Record<string, string> = {};
    if (payload.name !== undefined) {
      if (!payload.name.trim()) throw new BadRequestException('收藏夹名称不能为空');
      fields.name = payload.name.trim();
    }
    if (payload.description !== undefined) fields.description = payload.description;
    if (payload.coverUrl !== undefined) fields.coverUrl = payload.coverUrl;
    if (Object.keys(fields).length === 0) throw new BadRequestException('没有可更新的字段');
    return this.applyRevisionUpdate(collectionId, expectedRevision, { $set: fields });
  }

  /** 向收藏夹加入素材，基于修订号的乐观锁 */
  addAsset(collectionId: string, assetId: string, expectedRevision: number): Promise<RevisionUpdateResult> {
    const revision = this.parseExpectedRevision(expectedRevision);
    if (!Types.ObjectId.isValid(assetId)) throw new BadRequestException('素材 ID 不合法');
    return this.applyRevisionUpdate(collectionId, revision, {
      $addToSet: { assetIds: new Types.ObjectId(assetId) },
    });
  }

  /** 从收藏夹移除素材，基于修订号的乐观锁 */
  removeAsset(collectionId: string, assetId: string, expectedRevision: number): Promise<RevisionUpdateResult> {
    const revision = this.parseExpectedRevision(expectedRevision);
    if (!Types.ObjectId.isValid(assetId)) throw new BadRequestException('素材 ID 不合法');
    return this.applyRevisionUpdate(collectionId, revision, {
      $pull: { assetIds: new Types.ObjectId(assetId) },
    });
  }

  /**
   * 条件更新：仅当 revision 与调用方最后看到的版本一致才写入并自增修订号。
   * 条件不匹配说明期间有他人改动，本次不写任何字段，返回当前文档供调用方报冲突。
   */
  private async applyRevisionUpdate(
    collectionId: string,
    expectedRevision: number,
    update: Record<string, unknown>,
  ): Promise<RevisionUpdateResult> {
    await this.getByIdOrThrow(collectionId);
    const updated = await this.collectionModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(collectionId), revision: expectedRevision },
        { ...update, $inc: { revision: 1 } },
        { new: true, runValidators: true },
      )
      .exec();
    if (updated) return updated;
    return { conflict: true, current: await this.getByIdOrThrow(collectionId) };
  }

  private parseExpectedRevision(value: unknown): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
      throw new BadRequestException('必须提交最后看到的修订号 expectedRevision（正整数）');
    }
    return value;
  }
}
