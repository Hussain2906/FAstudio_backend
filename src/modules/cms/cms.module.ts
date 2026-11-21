import { Module } from '@nestjs/common';
import { CmsController } from './cms.controller.js';
import { CmsService } from './cms.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CsrfGuard } from '../auth/csrf.guard.js';

@Module({
  imports: [AuthModule],
  controllers: [CmsController],
  providers: [CmsService, PermissionsGuard, AuthGuard, CsrfGuard],
  exports: [CmsService],
})
export class CmsModule {}
