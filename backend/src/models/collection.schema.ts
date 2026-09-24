import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CollectionCollaborator, CollectionCollaboratorSchema } from './collectionCollaborator.schema';

export type CollectionDocument = HydratedDocument<Collection>;

@Schema({ timestamps: true })
export class Collection {
  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  creatorId!: string;

  @Prop()
  coverUrl?: string;

  @Prop({ type: [Types.ObjectId], ref: 'Asset', default: [] })
  assetIds!: Types.ObjectId[];

  @Prop({ default: false })
  isPublic!: boolean;

  @Prop({ type: [CollectionCollaboratorSchema], default: [] })
  collaborators!: CollectionCollaborator[];

  @Prop({ required: true, default: 1 })
  revision!: number;
}

export const CollectionSchema = SchemaFactory.createForClass(Collection);
CollectionSchema.index({ 'collaborators.userId': 1 });
