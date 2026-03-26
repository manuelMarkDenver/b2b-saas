import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { RequestWithUser } from './auth.types';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user?.isPlatformAdmin) {
      throw new ForbiddenException('Platform admin required');
    }
    return true;
  }
}
