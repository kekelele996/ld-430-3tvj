import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CollaboratorRole } from '../types/enums';

export type CollectionDocument = HydratedDocument<Collection>;

@Schema({ _id: false })
export class CollectionCollaborator {
  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true, enum: Object.values(CollaboratorRole) })
  role!: CollaboratorRole;
}

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

  @Prop({
    type: [CollectionCollaborator],
    default: [],
  })
  collaborators!: CollectionCollaborator[];

  @Prop({ default: 0, min: 0 })
  revision!: number;
}

export const CollectionSchema = SchemaFactory.createForClass(Collection);
