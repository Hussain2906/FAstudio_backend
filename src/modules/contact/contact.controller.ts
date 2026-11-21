import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../auth/auth.guard.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { CONTACT_DELIVERY_MANAGE, RequirePermissions } from '../auth/permissions.js';
import { ContactEnquiryDto } from './dto/contact-enquiry.dto.js';
import { UpdateContactSettingsDto } from './dto/update-contact-settings.dto.js';
import { ContactRateLimiter } from './contact-rate-limiter.js';
import { ContactService } from './contact.service.js';
import { getRateLimitClientIp } from '../../common/get-rate-limit-client-ip.js';

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(
    private readonly contactService: ContactService,
    private readonly rateLimiter: ContactRateLimiter,
    private readonly config: ConfigService,
  ) {}

  @Get('delivery-status')
  @ApiOperation({ summary: 'Read whether public contact delivery is configured' })
  getDeliveryStatus() {
    return this.contactService.getPublicStatus();
  }

  @Post('enquiries')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Send a public website enquiry by email' })
  async submitEnquiry(@Body() dto: ContactEnquiryDto, @Req() request: Request) {
    this.assertStorefrontOrigin(request);
    this.rateLimiter.consume(
      getRateLimitClientIp(request, this.config.get<boolean>('TRUST_RAILWAY_REAL_IP', false)),
    );

    // Silent success for the hidden bot field keeps the response indistinguishable from delivery.
    if (dto.website?.trim()) return { accepted: true };

    await this.contactService.sendEnquiry(dto);
    return { accepted: true };
  }

  @Get('admin/settings')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(CONTACT_DELIVERY_MANAGE)
  @ApiOperation({ summary: 'Read masked SMTP delivery settings for Admin' })
  getAdminSettings() {
    return this.contactService.getAdminSettings();
  }

  @Put('admin/settings')
  @UseGuards(AuthGuard, CsrfGuard, PermissionsGuard)
  @RequirePermissions(CONTACT_DELIVERY_MANAGE)
  @ApiOperation({ summary: 'Update SMTP delivery settings' })
  updateAdminSettings(@Body() dto: UpdateContactSettingsDto) {
    return this.contactService.updateSettings(dto);
  }

  @Post('admin/settings/verify')
  @UseGuards(AuthGuard, CsrfGuard, PermissionsGuard)
  @RequirePermissions(CONTACT_DELIVERY_MANAGE)
  @ApiOperation({ summary: 'Verify SMTP settings without sending an email' })
  verifyAdminSettings() {
    return this.contactService.verifyConnection();
  }

  private assertStorefrontOrigin(request: Request): void {
    const origin = request.headers.origin;
    if (!origin) throw new ForbiddenException('A valid storefront origin is required.');
    try {
      const expectedOrigin = new URL(
        this.config.getOrThrow<string>('STOREFRONT_URL'),
      ).origin;
      if (new URL(origin).origin !== expectedOrigin) {
        throw new ForbiddenException('A valid storefront origin is required.');
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ForbiddenException('A valid storefront origin is required.');
    }
  }
}
