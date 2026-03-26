import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { REQUEST_ID_HEADER } from "./request-id.middleware";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const requestId = (res.getHeader(REQUEST_ID_HEADER) as string) || undefined;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === "string"
          ? response
          : (response as any)?.message ?? exception.message;

      res.status(status).json({
        code: "HTTP_EXCEPTION",
        message,
        requestId,
        path: req.originalUrl,
      });
      return;
    }

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      requestId,
      path: req.originalUrl,
    });
  }
}
