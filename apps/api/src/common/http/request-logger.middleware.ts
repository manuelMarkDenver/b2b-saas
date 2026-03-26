import type { NextFunction, Request, Response } from 'express';
import type { Logger as PinoLogger } from 'pino';
import { REQUEST_ID_HEADER } from './request-id.middleware';

export function requestLoggerMiddleware(logger: PinoLogger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      logger.info({
        requestId: res.getHeader(REQUEST_ID_HEADER),
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
      });
    });
    next();
  };
}
