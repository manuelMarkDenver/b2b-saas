import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Tenant } from '@prisma/client';
import type { RequestWithUser } from './auth.types';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Tenant | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.tenant;
  },
);
