import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AUTH_CSRF_COOKIE, AUTH_CSRF_HEADER } from './auth.constants.js';
import { readCsrfToken } from './auth.cookies.js';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    const cookieToken = readCsrfToken(request, AUTH_CSRF_COOKIE);
    const headerToken = request.headers[AUTH_CSRF_HEADER];
    const requestToken = Array.isArray(headerToken) ? headerToken[0] : headerToken;
    if (!cookieToken || !requestToken || cookieToken !== requestToken) {
      throw new ForbiddenException('CSRF validation failed.');
    }
    return true;
  }
}
