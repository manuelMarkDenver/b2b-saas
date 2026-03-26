import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions';

export const REQUIRE_PERMISSIONS_KEY = 'requirePermissions';

export function RequirePermissions(...permissions: Permission[]) {
  return SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);
}
