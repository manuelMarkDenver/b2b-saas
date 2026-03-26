import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestWithUser } from './auth.types';
import {
  hasAllPermissions,
  Permission,
  type TenantRole,
} from './permissions';
import { REQUIRE_PERMISSIONS_KEY } from './require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<Permission[]>(REQUIRE_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (required.length === 0) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) throw new UnauthorizedException();
    if (!request.tenant || !request.membership) {
      throw new ForbiddenException('Tenant context required');
    }

    const role = request.membership.role as TenantRole;
    if (!hasAllPermissions(role, required)) {
      throw new ForbiddenException('Missing permissions');
    }

    return true;
  }
}
