import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import nodemailer from 'nodemailer';
import { PrismaService } from '../../database/prisma.service.js';
import type { ContactEnquiryDto } from './dto/contact-enquiry.dto.js';
import type { UpdateContactSettingsDto } from './dto/update-contact-settings.dto.js';

const SETTINGS_ID = 'singleton';
const smtpHostnamePattern = /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))+$/;

type SettingsRecord = NonNullable<
  Awaited<ReturnType<PrismaService['contactDeliverySettings']['findUnique']>>
>;

type AdminSettingsResponse = {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  fromEmail: string;
  fromName: string;
  recipientEmail: string;
  hasSmtpPassword: boolean;
  encryptionKeyConfigured: boolean;
  ready: boolean;
};

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getAdminSettings(): Promise<AdminSettingsResponse> {
    const settings = await this.prisma.contactDeliverySettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    return this.toAdminResponse(settings);
  }

  async getPublicStatus(): Promise<{ ready: boolean }> {
    const settings = await this.prisma.contactDeliverySettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    return { ready: this.isReady(settings) };
  }

  async updateSettings(dto: UpdateContactSettingsDto): Promise<AdminSettingsResponse> {
    const current = await this.prisma.contactDeliverySettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    const username = dto.smtpUsername.trim();
    let encryptedPassword = current?.smtpPasswordEncrypted ?? null;

    if (dto.clearSmtpPassword) {
      encryptedPassword = null;
    } else if (typeof dto.smtpPassword === 'string' && dto.smtpPassword.length > 0) {
      if (!username) {
        throw new BadRequestException('Enter an SMTP username before saving a password.');
      }
      const key = this.getEncryptionKey();
      if (!key) {
        throw new ServiceUnavailableException(
          'SMTP credential encryption is not configured on the backend.',
        );
      }
      encryptedPassword = this.encryptPassword(dto.smtpPassword, key);
    } else if (current && current.smtpUsername !== username) {
      encryptedPassword = null;
    }

    if (!username) encryptedPassword = null;

    const data = {
      smtpHost: dto.smtpHost.trim().toLowerCase(),
      smtpPort: dto.smtpPort,
      smtpSecure: dto.smtpSecure,
      smtpUsername: username,
      smtpPasswordEncrypted: encryptedPassword,
      fromEmail: dto.fromEmail.trim().toLowerCase(),
      fromName:
        dto.fromName.replace(/[\r\n]+/g, ' ').trim().slice(0, 100) || 'FA Studio',
      recipientEmail: dto.recipientEmail.trim().toLowerCase(),
    };

    const saved = await this.prisma.contactDeliverySettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...data },
      update: data,
    });
    return this.toAdminResponse(saved);
  }

  async verifyConnection(): Promise<{ verified: true }> {
    const settings = await this.prisma.contactDeliverySettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    if (!this.isReady(settings)) {
      throw new ServiceUnavailableException(
        'Complete the SMTP settings before verifying the connection.',
      );
    }

    let transport: ReturnType<typeof nodemailer.createTransport> | undefined;
    try {
      transport = await this.createTransport(settings);
      await transport.verify();
      return { verified: true };
    } catch {
      this.logger.warn('SMTP connection verification failed.');
      throw new ServiceUnavailableException(
        'SMTP verification failed. Check the host, port, TLS mode, username, and password.',
      );
    } finally {
      transport?.close();
    }
  }

  async sendEnquiry(dto: ContactEnquiryDto): Promise<void> {
    let transport: ReturnType<typeof nodemailer.createTransport> | undefined;
    try {
      const settings = await this.prisma.contactDeliverySettings.findUnique({
        where: { id: SETTINGS_ID },
      });
      if (!this.isReady(settings)) {
        throw new Error('Contact delivery is not configured.');
      }

      transport = await this.createTransport(settings);
      const safeName = dto.name.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').slice(0, 120);
      const details = [
        `Name: ${safeName}`,
        `Email: ${dto.email}`,
        dto.phone ? `Phone: ${dto.phone}` : '',
        dto.projectType ? `Service: ${dto.projectType}` : '',
        '',
        'Message:',
        dto.message,
      ]
        .filter((line) => line !== '')
        .join('\n');

      await transport.sendMail({
        from: {
          name: settings.fromName.replace(/[\r\n]+/g, ' ').slice(0, 100),
          address: settings.fromEmail,
        },
        to: settings.recipientEmail,
        replyTo: dto.email,
        subject: `Website enquiry from ${safeName}`,
        text: details,
      });
    } catch {
      this.logger.warn('Contact enquiry delivery failed.');
      throw new ServiceUnavailableException(
        'We could not send your message right now. Please email or phone the Studio instead.',
      );
    } finally {
      transport?.close();
    }
  }

  private toAdminResponse(settings: SettingsRecord | null): AdminSettingsResponse {
    const keyConfigured = this.getEncryptionKey() !== null;
    return {
      smtpHost: settings?.smtpHost ?? '',
      smtpPort: settings?.smtpPort ?? 587,
      smtpSecure: settings?.smtpSecure ?? false,
      smtpUsername: settings?.smtpUsername ?? '',
      fromEmail: settings?.fromEmail ?? '',
      fromName: settings?.fromName ?? 'FA Studio',
      recipientEmail: settings?.recipientEmail ?? '',
      hasSmtpPassword: Boolean(settings?.smtpPasswordEncrypted),
      encryptionKeyConfigured: keyConfigured,
      ready: this.isReady(settings),
    };
  }

  private isReady(settings: SettingsRecord | null): settings is SettingsRecord {
    if (!settings) return false;
    const hasAuth = Boolean(settings.smtpUsername.trim());
    const authReady =
      !hasAuth ||
      (settings.smtpPasswordEncrypted !== null &&
        this.canDecryptPassword(settings.smtpPasswordEncrypted));
    return Boolean(
      settings.smtpHost &&
        smtpHostnamePattern.test(settings.smtpHost) &&
        settings.smtpPort >= 1 &&
        settings.smtpPort <= 65535 &&
        settings.fromEmail &&
        settings.recipientEmail &&
        authReady,
    );
  }

  private getEncryptionKey(): Buffer | null {
    const value = this.config.get<string>('CONTACT_SMTP_ENCRYPTION_KEY');
    if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) return null;
    return Buffer.from(value, 'hex');
  }

  private canDecryptPassword(encrypted: string): boolean {
    const key = this.getEncryptionKey();
    if (!key) return false;
    try {
      this.decryptPassword(encrypted, key);
      return true;
    } catch {
      return false;
    }
  }

  private encryptPassword(password: string, key: Buffer): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
    return [
      'v1',
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  private decryptPassword(encrypted: string, key: Buffer): string {
    const [version, ivValue, tagValue, ciphertextValue] = encrypted.split(':');
    if (version !== 'v1' || !ivValue || !tagValue || ciphertextValue === undefined) {
      throw new ServiceUnavailableException('Stored SMTP credentials cannot be read.');
    }
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64'));
      decipher.setAuthTag(Buffer.from(tagValue, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextValue, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException('Stored SMTP credentials cannot be read.');
    }
  }

  private async createTransport(settings: SettingsRecord) {
    const address = await this.resolvePublicSmtpHost(settings.smtpHost);
    const key = this.getEncryptionKey();
    const password = settings.smtpPasswordEncrypted
      ? key
        ? this.decryptPassword(settings.smtpPasswordEncrypted, key)
        : (() => {
            throw new ServiceUnavailableException(
              'SMTP credential encryption is not configured on the backend.',
            );
          })()
      : undefined;

    return nodemailer.createTransport({
      host: address,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      requireTLS: !settings.smtpSecure,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      name: settings.smtpHost,
      auth: settings.smtpUsername && password
        ? { user: settings.smtpUsername, pass: password }
        : undefined,
      tls: {
        servername: settings.smtpHost,
        minVersion: 'TLSv1.2',
      },
      logger: false,
      debug: false,
    });
  }

  private async resolvePublicSmtpHost(host: string): Promise<string> {
    const normalizedHost = host.trim().toLowerCase();
    if (!smtpHostnamePattern.test(normalizedHost) || isIP(normalizedHost)) {
      throw new BadRequestException('Use a public SMTP hostname, not a URL or IP address.');
    }
    const records = await lookup(normalizedHost, { all: true, verbatim: true });
    if (!records.length || records.some((record) => isNonPublicAddress(record.address))) {
      throw new BadRequestException('The SMTP host must resolve only to public IP addresses.');
    }
    return records[0].address;
  }
}

export function isNonPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (version === 6) {
    const normalized = address.toLowerCase().split('%')[0];
    const [firstGroup = '', secondGroup = ''] = normalized.split(':');
    const first = Number.parseInt(firstGroup || '0', 16);
    const second = Number.parseInt(secondGroup || '0', 16);
    if (!Number.isInteger(first) || !Number.isInteger(second)) return true;

    // Permit only global-unicast 2000::/3 addresses, excluding protocol, transition,
    // documentation, and reserved blocks that can be used to target special networks.
    return (
      first < 0x2000 ||
      first > 0x3fff ||
      first === 0x2001 && (second <= 0x01ff || second === 0x0db8) ||
      first === 0x2002 ||
      first === 0x3fff
    );
  }
  return true;
}
