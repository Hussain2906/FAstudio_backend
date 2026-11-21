import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';

/** Mutation authorization is intentionally fail-closed until admin auth/RBAC is available. */
@Injectable()
export class CmsMutationGuard implements CanActivate {
  canActivate(): boolean {
    throw new ForbiddenException('CMS mutations require admin authorization.');
  }
}
