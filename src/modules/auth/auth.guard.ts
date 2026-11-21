import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import type { AuthenticatedAdmin } from './auth.types.js';

export type AuthenticatedRequest = Request & { admin?: AuthenticatedAdmin };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const admin = await this.authService.getAuthenticatedAdmin(request);
    if (!admin) throw new UnauthorizedException('Authentication required.');
    request.admin = admin;
    return true;
  }
}
