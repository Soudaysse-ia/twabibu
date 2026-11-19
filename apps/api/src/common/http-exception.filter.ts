import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { ApiError, ErrorCode } from '@twabibu/contracts';
import { ApiException } from './api-exception.js';

const FROM_STATUS: Record<number, ErrorCode> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

/** Turns every error into `{ code, message, details? }`. Never leaks stack traces or SQL. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiError = { code: 'INTERNAL_ERROR', message: 'Internal error' };

    if (exception instanceof ApiException) {
      status = exception.getStatus();
      body = exception.getResponse() as ApiError;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      body = { code: FROM_STATUS[status] ?? 'INTERNAL_ERROR', message: exception.message };
    } else {
      this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception));
    }
    res.status(status).json(body);
  }
}
