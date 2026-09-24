import { SetMetadata } from '@nestjs/common';

export enum CollectionAction {
  Create = 'create',
  Read = 'read',
  Edit = 'edit',
  Manage = 'manage',
}

export const COLLECTION_ACTION_METADATA = 'collection:action';

export const CollectionActionRequired = (action: CollectionAction) => SetMetadata(COLLECTION_ACTION_METADATA, action);
