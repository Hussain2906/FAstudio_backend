import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ContactController } from './contact.controller.js';
import { ContactRateLimiter } from './contact-rate-limiter.js';
import { ContactService } from './contact.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ContactController],
  providers: [ContactService, ContactRateLimiter],
})
export class ContactModule {}
