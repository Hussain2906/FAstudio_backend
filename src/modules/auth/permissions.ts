import { SetMetadata } from '@nestjs/common';
import type { AdminRole } from '../../generated/prisma/enums.js';

export const CMS_READ = 'cms:read';
export const CMS_WRITE = 'cms:write';
export const CMS_PUBLISH = 'cms:publish';
export const CONTACT_DELIVERY_MANAGE = 'contact-delivery:manage';

export const rolePermissions: Record<AdminRole, readonly string[]> = {
  SUPER_ADMIN: [CMS_READ, CMS_WRITE, CMS_PUBLISH, CONTACT_DELIVERY_MANAGE],
  ADMIN: [CMS_READ, CMS_WRITE, CMS_PUBLISH, CONTACT_DELIVERY_MANAGE],
  EDITOR: [CMS_READ, CMS_WRITE],
};

export const REQUIRED_PERMISSIONS = 'required_permissions';
export const RequirePermissions = (...permissions: string[]) => SetMetadata(REQUIRED_PERMISSIONS, permissions);
