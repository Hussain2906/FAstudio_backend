import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException ? this.getMessage(exception) : 'Internal server error';

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      const error = exception instanceof Error ? exception : undefined;
      const exceptionType = error?.constructor?.name || typeof exception;
      const exceptionMessage = error?.message ?? 'Non-Error exception';
      const stack = error?.stack ?? '';
      this.logger.error(
        JSON.stringify({
          exceptionType: sanitizeLogValue(exceptionType),
          message: sanitizeLogValue(exceptionMessage),
          stack: sanitizeLogValue(stack),
        }),
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private getMessage(exception: HttpException): string | string[] {
    const message = exception.getResponse();
    if (typeof message === 'string') return message;
    if (typeof message === 'object' && message !== null && 'message' in message) {
      const value = message.message;
      return Array.isArray(value) ? value : String(value);
    }
    return exception.message;
  }
}

const secretAssignment = /\b(password|passwd|pwd|token|access[_-]?token|refresh[_-]?token|secret|api[_-]?key|authorization|cookie|set-cookie|connection[_-]?string|database_url|direct_url)\b(\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi;
const connectionCredentials = /\b((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/)[^\s/@]+@/gi;
const bearerCredential = /\b(bearer)\s+[a-z0-9._~+/-]+=*/gi;
const jwtCredential = /\beyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g;

function sanitizeLogValue(value: string): string {
  return value
    .replace(connectionCredentials, '$1[REDACTED]@')
    .replace(secretAssignment, '$1$2[REDACTED]')
    .replace(bearerCredential, '$1 [REDACTED]')
    .replace(jwtCredential, '[REDACTED]');
}
