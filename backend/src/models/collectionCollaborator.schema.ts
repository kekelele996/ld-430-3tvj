import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { CollectionCollaboratorRole } from '../types/enums';

@Schema({ _id: false })
export class CollectionCollaborator {
  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true, enum: Object.values(CollectionCollaboratorRole) })
  role!: CollectionCollaboratorRole;

  @Prop()
  addedAt?: Date;
}

export const CollectionCollaboratorSchema = SchemaFactory.createForClass(CollectionCollaborator);
