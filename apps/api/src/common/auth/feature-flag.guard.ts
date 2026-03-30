import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestWithUser } from './auth.types';
import { type FeatureFlag } from '@repo/shared';

export type { FeatureFlag };

export const FEATURE_FLAG_KEY = 'featureFlag';
export const RequireFeature = (flag: FeatureFlag) =>
  SetMetadata(FEATURE_FLAG_KEY, flag);

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const flag = this.reflector.getAllAndOverride<FeatureFlag>(FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!flag) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const tenant = request.tenant;

    if (!tenant) return true; // TenantGuard handles missing tenant

    const features = tenant.features as Record<string, boolean> | null;
    if (!features || features[flag] !== true) {
      throw new ForbiddenException(`Feature '${flag}' is not enabled for this tenant`);
    }

    return true;
  }
}
