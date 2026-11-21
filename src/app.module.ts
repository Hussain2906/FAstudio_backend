import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module.js';
import { environmentValidationSchema } from './config/env.validation.js';
import { CmsModule } from './modules/cms/cms.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { ContactModule } from './modules/contact/contact.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [resolve(process.cwd(), 'fs_backend/.env'), resolve(process.cwd(), '.env')],
      validationSchema: environmentValidationSchema,
    }),
    DatabaseModule,
    HealthModule,
    CloudinaryModule,
    CmsModule,
    AuthModule,
    MediaModule,
    ContactModule,
  ],
})
export class AppModule {}
