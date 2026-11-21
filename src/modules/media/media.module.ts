import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CloudinaryModule } from '../cloudinary/cloudinary.module.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { MediaController } from './media.controller.js';

@Module({
  imports: [AuthModule, CloudinaryModule],
  controllers: [MediaController],
  providers: [AuthGuard, CsrfGuard, PermissionsGuard],
})
export class MediaModule {}
