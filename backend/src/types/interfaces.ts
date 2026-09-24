import type { Request } from 'express';
import { CollectionCollaboratorRole, UserRole } from './enums';

export interface AuthUser {
  id: string;
  role: UserRole;
  canDownloadCommercial?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface CollectionCollaboratorInput {
  userId: string;
  role: CollectionCollaboratorRole;
}

export interface CollectionMetaUpdatePayload {
  name?: string;
  description?: string;
  coverUrl?: string;
  expectedRevision?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
