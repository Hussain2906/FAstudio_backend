import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../database/prisma.service.js';
import { ContactService, isNonPublicAddress } from './contact.service.js';

const ENCRYPTION_KEY = 'a'.repeat(64);

function settingsDto(overrides: Record<string, unknown> = {}) {
  return {
    smtpHost: 'smtp.example.com',
    smtpPort: 587,
    smtpSecure: false,
    smtpUsername: 'studio@example.com',
    smtpPassword: 'not-a-real-password',
    clearSmtpPassword: false,
    fromName: 'FA Studio',
    fromEmail: 'studio@example.com',
    recipientEmail: 'inbox@example.com',
    ...overrides,
  } as never;
}

describe('ContactService SMTP settings', () => {
  function createService(key: string | undefined) {
    const findUnique = jest.fn();
    const upsert = jest.fn();
    const prisma = {
      contactDeliverySettings: { findUnique, upsert },
    } as unknown as PrismaService;
    const config = {
      get: jest.fn((name: string) =>
        name === 'CONTACT_SMTP_ENCRYPTION_KEY' ? key : undefined,
      ),
    } as unknown as ConfigService;
    return { service: new ContactService(prisma, config), findUnique, upsert };
  }

  it('stores SMTP passwords encrypted and never returns the secret', async () => {
    const { service, findUnique, upsert } = createService(ENCRYPTION_KEY);
    let savedCiphertext = '';
    findUnique.mockResolvedValue(null);
    upsert.mockImplementation((args: { create: Record<string, unknown> }) => {
      const value = args.create.smtpPasswordEncrypted;
      savedCiphertext = typeof value === 'string' ? value : '';
      return Promise.resolve(args.create);
    });

    const response = await service.updateSettings(settingsDto());

    expect(savedCiphertext).toMatch(/^v1:/);
    expect(savedCiphertext).not.toContain('not-a-real-password');
    expect(response).toMatchObject({
      hasSmtpPassword: true,
      encryptionKeyConfigured: true,
      ready: true,
    });
    expect(response).not.toHaveProperty('smtpPassword');
    expect(response).not.toHaveProperty('smtpPasswordEncrypted');
  });

  it('refuses to store a new credential when the encryption key is missing', async () => {
    const { service, findUnique, upsert } = createService(undefined);
    findUnique.mockResolvedValue(null);

    await expect(service.updateSettings(settingsDto())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it('requires an SMTP username when saving an authentication password', async () => {
    const { service, findUnique, upsert } = createService(ENCRYPTION_KEY);
    findUnique.mockResolvedValue(null);

    await expect(service.updateSettings(settingsDto({ smtpUsername: '' }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it('reports delivery unavailable when the stored password cannot be decrypted', async () => {
    const { service, findUnique } = createService(ENCRYPTION_KEY);
    findUnique.mockResolvedValue({
      id: 'singleton',
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpSecure: false,
      smtpUsername: 'studio@example.com',
      smtpPasswordEncrypted: 'v1:AA==:AA==:AA==',
      fromEmail: 'studio@example.com',
      fromName: 'FA Studio',
      recipientEmail: 'inbox@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.getPublicStatus()).resolves.toEqual({ ready: false });
  });

  it('keeps the public delivery status false before configuration', async () => {
    const { service, findUnique } = createService(ENCRYPTION_KEY);
    findUnique.mockResolvedValue(null);

    await expect(service.getPublicStatus()).resolves.toEqual({ ready: false });
  });
});

describe('SMTP address range guard', () => {
  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '127.0.0.1',
    '169.254.10.10',
    '172.20.0.1',
    '192.168.1.1',
    '198.18.0.1',
    '224.0.0.1',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    'ff02::1',
    '2001:db8::1',
    '2001:10::1',
    '2002:0808:0808::1',
    '3fff::1',
  ])('blocks non-public address %s', (address) => {
    expect(isNonPublicAddress(address)).toBe(true);
  });

  it.each(['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])('allows public address %s', (address) => {
    expect(isNonPublicAddress(address)).toBe(false);
  });
});
