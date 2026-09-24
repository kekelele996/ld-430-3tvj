import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Collection, type CollectionDocument } from '../models/collection.schema';
import { CollaboratorRole } from '../types/enums';

@Injectable()
export class CollectionService {
  constructor(@InjectModel(Collection.name) private readonly collectionModel: Model<CollectionDocument>) {}

  /** 当前用户可见的收藏夹：自己创建的、自己参与协作的，以及所有公开收藏夹。 */
  findVisible(userId: string) {
    return this.collectionModel
      .find({ $or: [{ creatorId: userId }, { 'collaborators.userId': userId }, { isPublic: true }] })
      .sort({ createdAt: -1 })
      .exec();
  }

  async create(userId: string, payload: Partial<Collection>) {
    return this.collectionModel.create({
      name: payload.name,
      description: payload.description,
      coverUrl: payload.coverUrl,
      isPublic: payload.isPublic ?? false,
      creatorId: userId,
      assetIds: [],
      collaborators: [],
      revision: 0,
    });
  }

  /** 读取单个收藏夹，创建人、任意协作成员可读，非成员仅公开夹可读。 */
  async findForRead(collectionId: string, userId: string) {
    const collection = await this.getById(collectionId);
    if (!this.canRead(collection, userId)) {
      throw new ForbiddenException('无权访问该收藏夹');
    }
    return collection;
  }

  /** 仅创建人可管理协作成员。 */
  async listCollaborators(collectionId: string, userId: string) {
    const collection = await this.getById(collectionId);
    this.assertCreator(collection, userId);
    return collection.collaborators;
  }

  /** 添加协作成员或更新其身份，已是成员时按新身份覆盖。 */
  async addCollaborator(collectionId: string, actorId: string, userId: string, role: CollaboratorRole) {
    const collection = await this.getById(collectionId);
    this.assertCreator(collection, actorId);
    if (userId === collection.creatorId) {
      throw new BadRequestException('创建人本身即拥有收藏夹全部权限，无需作为协作成员添加');
    }
    const existing = collection.collaborators.find((item) => item.userId === userId);
    const updated = existing
      ? await this.collectionModel.findByIdAndUpdate(
          collection._id,
          { $set: { 'collaborators.$[member].role': role } },
          { new: true, arrayFilters: [{ 'member.userId': userId }] },
        ).exec()
      : await this.collectionModel
          .findByIdAndUpdate(collection._id, { $addToSet: { collaborators: { userId, role } } }, { new: true })
          .exec();
    return updated;
  }

  /** 移除协作成员；权限在后续请求实时查库校验，因此移除立即生效。 */
  async removeCollaborator(collectionId: string, actorId: string, userId: string) {
    const collection = await this.getById(collectionId);
    this.assertCreator(collection, actorId);
    return this.collectionModel
      .findByIdAndUpdate(collection._id, { $pull: { collaborators: { userId } } }, { new: true })
      .exec();
  }

  /** 编辑身份（及创建人）可改名，需携带最后看到的修订号。 */
  rename(collectionId: string, userId: string, name: string, expectedRevision: number | undefined) {
    return this.commit({
      collectionId,
      userId,
      expectedRevision,
      update: { name },
    });
  }

  /** 编辑身份（及创建人）可加入素材，需携带最后看到的修订号。 */
  async addAsset(collectionId: string, assetId: string, userId: string, expectedRevision: number | undefined) {
    this.assertObjectId(assetId, '素材');
    return this.commit({
      collectionId,
      userId,
      expectedRevision,
      addToSet: { assetIds: new Types.ObjectId(assetId) },
    });
  }

  /** 编辑身份（及创建人）可移除素材，需携带最后看到的修订号。 */
  async removeAsset(collectionId: string, assetId: string, userId: string, expectedRevision: number | undefined) {
    this.assertObjectId(assetId, '素材');
    return this.commit({
      collectionId,
      userId,
      expectedRevision,
      pull: { assetIds: new Types.ObjectId(assetId) },
    });
  }

  /**
   * 乐观锁提交：expectedRevision 与当前 revision 一致才写入并自增。
   * 若期间已有他人改动，保留当前名称和素材，返回冲突与最新修订号，不覆盖对方改动。
   */
  private async commit(params: {
    collectionId: string;
    userId: string;
    expectedRevision: number | undefined;
    update?: Record<string, unknown>;
    addToSet?: Record<string, unknown>;
    pull?: Record<string, unknown>;
  }): Promise<CollectionDocument> {
    const { collectionId, userId, expectedRevision, update = {}, addToSet, pull } = params;
    const collection = await this.getById(collectionId);
    this.assertCanEdit(collection, userId);
    if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 0) {
      throw new BadRequestException('编辑请求必须携带最后看到的非负整数修订号 revision');
    }
    const modifier: Record<string, unknown> = {
      ...update,
      $inc: { revision: 1 },
    };
    if (addToSet) modifier.$addToSet = addToSet;
    if (pull) modifier.$pull = pull;

    const updated = await this.collectionModel
      .findOneAndUpdate(
        { _id: collection._id, revision: expectedRevision },
        modifier,
        { new: true },
      )
      .exec();
    if (!updated) {
      const latest = await this.getById(collectionId);
      throw new ConflictException({
        message: '收藏夹已被他人修改，请基于最新版本重试',
        code: 'COLLECTION_REVISION_CONFLICT',
        latestRevision: latest.revision,
        current: { name: latest.name, assetIds: latest.assetIds },
      });
    }
    return updated;
  }

  private canRead(collection: CollectionDocument, userId: string): boolean {
    return (
      collection.isPublic ||
      collection.creatorId === userId ||
      collection.collaborators.some((item) => item.userId === userId)
    );
  }

  private assertCanEdit(collection: CollectionDocument, userId: string) {
    if (collection.creatorId === userId) return;
    const member = collection.collaborators.find((item) => item.userId === userId);
    if (!member) {
      throw new ForbiddenException('你不是该收藏夹的协作成员');
    }
    if (member.role !== CollaboratorRole.Editor) {
      throw new ForbiddenException('查看身份只能读取清单，不能修改收藏夹');
    }
  }

  private assertCreator(collection: CollectionDocument, userId: string) {
    if (collection.creatorId !== userId) {
      throw new ForbiddenException('只有创建人可以管理协作成员');
    }
  }

  private async getById(collectionId: string) {
    this.assertObjectId(collectionId, '收藏夹');
    const collection = await this.collectionModel.findById(collectionId).exec();
    if (!collection) throw new NotFoundException('收藏夹不存在');
    return collection;
  }

  private assertObjectId(id: string, label: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`${label} ID 格式不合法`);
    }
  }
}
