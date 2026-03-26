import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const existing = req.header(REQUEST_ID_HEADER);
  const requestId = existing && existing.length > 0 ? existing : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
