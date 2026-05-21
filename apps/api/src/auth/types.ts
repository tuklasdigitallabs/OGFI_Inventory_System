import { RoleCode } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  mustChangePassword: boolean;
  role: {
    id: string;
    code: RoleCode;
    name: string;
  };
  permissions: string[];
  locationIds: string[];
}

export interface AccessTokenPayload {
  sub: string;
}
