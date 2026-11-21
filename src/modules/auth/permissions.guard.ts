import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS, rolePermissions } from './permissions.js';
import type { AuthenticatedRequest } from './auth.guard.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [context.getHandler(), context.getClass()]) ?? [];
    if (required.length === 0) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const permissions = request.admin ? rolePermissions[request.admin.role] : [];
    if (!required.every((permission) => permissions.includes(permission))) {
      throw new ForbiddenException('Insufficient permissions.');
    }
    return true;
  }
}
