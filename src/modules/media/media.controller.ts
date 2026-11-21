import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { CMS_WRITE, RequirePermissions } from '../auth/permissions.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';

@Controller('media')
export class MediaController {
  constructor(private readonly cloudinary: CloudinaryService) {}

  @Get('admin/library')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(CMS_WRITE)
  list(@Query('next_cursor') nextCursor?: string) {
    if (nextCursor && nextCursor.length > 2048)
      throw new BadRequestException('Invalid media library cursor.');
    return this.cloudinary.listImages(nextCursor);
  }

  @Post('admin/upload')
  @UseGuards(AuthGuard, CsrfGuard, PermissionsGuard)
  @RequirePermissions(CMS_WRITE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  upload(@UploadedFile() file: { buffer: Buffer } | undefined) {
    if (!file?.buffer) return this.cloudinary.uploadImage(Buffer.alloc(0));
    return this.cloudinary.uploadImage(file.buffer);
  }

  @Post('admin/upload-video')
  @UseGuards(AuthGuard, CsrfGuard, PermissionsGuard)
  @RequirePermissions(CMS_WRITE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  uploadVideo(@UploadedFile() file: { buffer: Buffer } | undefined) {
    if (!file?.buffer) return this.cloudinary.uploadVideo(Buffer.alloc(0));
    return this.cloudinary.uploadVideo(file.buffer);
  }
}
