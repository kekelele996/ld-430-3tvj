import { CollaboratorRole, UserRole } from './enums';

export interface AuthUser {
  id: string;
  role: UserRole;
  canDownloadCommercial?: boolean;
}

export interface CollectionCollaborator {
  userId: string;
  role: CollaboratorRole;
}

export interface CollectionRenameBody {
  name: string;
  revision: number;
}

export interface CollectionAssetBody {
  revision: number;
}

export interface CollectionCollaboratorBody {
  userId: string;
  role: CollaboratorRole;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
