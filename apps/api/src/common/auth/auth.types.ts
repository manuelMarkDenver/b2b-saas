import type { Request } from 'express';
import type { Tenant } from '@prisma/client';
import type { TenantMembership } from '@prisma/client';

export type AuthUser = {
  id: string;
  email: string;
  isPlatformAdmin: boolean;
  status: 'ACTIVE' | 'DISABLED';
};

export type RequestWithUser = Request & {
  user: AuthUser;
  tenant?: Tenant;
  membership?: TenantMembership;
};
