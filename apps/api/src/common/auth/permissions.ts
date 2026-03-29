export enum Permission {
  MEMBERSHIPS_READ = 'MEMBERSHIPS_READ',
  MEMBERSHIPS_MANAGE = 'MEMBERSHIPS_MANAGE',
}

export type TenantRole = 'OWNER' | 'ADMIN' | 'STAFF' | 'VIEWER';

export const ROLE_PERMISSIONS: Record<TenantRole, ReadonlySet<Permission>> = {
  OWNER: new Set([Permission.MEMBERSHIPS_READ, Permission.MEMBERSHIPS_MANAGE]),
  ADMIN: new Set([Permission.MEMBERSHIPS_READ]),
  STAFF: new Set([Permission.MEMBERSHIPS_READ]),
  VIEWER: new Set([Permission.MEMBERSHIPS_READ]),
};

export function hasAllPermissions(role: TenantRole, required: Permission[]) {
  const granted = ROLE_PERMISSIONS[role];
  for (const permission of required) {
    if (!granted.has(permission)) return false;
  }
  return true;
}
