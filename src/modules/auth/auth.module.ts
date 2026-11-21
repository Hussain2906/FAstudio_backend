import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { CsrfGuard } from './csrf.guard.js';
import { PermissionsGuard } from './permissions.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, CsrfGuard, PermissionsGuard],
  exports: [AuthGuard, AuthService, CsrfGuard, PermissionsGuard],
})
export class AuthModule {}
