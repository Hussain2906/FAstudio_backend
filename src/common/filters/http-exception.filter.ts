import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException ? this.getMessage(exception) : 'Internal server error';

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
