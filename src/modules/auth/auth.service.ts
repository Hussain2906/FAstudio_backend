import { randomBytes } from 'node:crypto';
import { HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import type { Request, Response } from 'express';
import { PrismaService } from '../../database/prisma.service.js';
import { getRateLimitClientIp } from '../../common/get-rate-limit-client-ip.js';
import { AUTH_BLOCK_MS, AUTH_CSRF_COOKIE, AUTH_LOGIN_WINDOW_MS, AUTH_MAX_LOGIN_ATTEMPTS, AUTH_SESSION_COOKIE } from './auth.constants.js';
import { hashSessionToken, readSessionToken } from './auth.cookies.js';
import type { AuthenticatedAdmin } from './auth.types.js';
import type { LoginDto } from './dto/login.dto.js';

const genericLoginMessage = 'Invalid email or password.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly sessionTtlSeconds: number;
  private readonly sessionCookieName: string;
  private readonly trustRailwayRealIp: boolean;
  private readonly authDiagnosticsEnabled: boolean;

  constructor(private readonly prisma: PrismaService, config: ConfigService) {
    this.sessionTtlSeconds = config.get<number>('AUTH_SESSION_TTL_SECONDS', 28_800);
    this.sessionCookieName = config.get<string>('AUTH_SESSION_COOKIE_NAME', AUTH_SESSION_COOKIE);
    this.trustRailwayRealIp = config.get<boolean>('TRUST_RAILWAY_REAL_IP', false);
    this.authDiagnosticsEnabled = config.get<boolean>('AUTH_DIAGNOSTICS_ENABLED', false);
  }

  async login(dto: LoginDto, request: Request, response: Response) {
    const email = dto.email.trim().toLowerCase();
    const key = `${getRateLimitClientIp(request, this.trustRailwayRealIp)}:${email}`;
    await this.assertLoginAllowed(key);

    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    const valid = admin?.isActive ? await argon2.verify(admin.passwordHash, dto.password) : false;
    if (!valid || !admin) {
      await this.recordFailedLogin(key, admin?.id);
      throw new UnauthorizedException(genericLoginMessage);
    }

    await this.prisma.adminLoginAttempt.deleteMany({ where: { key } });
    const rawSessionToken = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.sessionTtlSeconds * 1000);
    const session = await this.prisma.adminSession.create({
      data: { tokenHash: hashSessionToken(rawSessionToken), adminUserId: admin.id, expiresAt },
    });
    await this.prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    this.setCookies(response, rawSessionToken, csrfToken, expiresAt);
    return { admin: { id: admin.id, email: admin.email, role: admin.role }, csrfToken, sessionId: session.id };
  }

  async logout(request: Request, response: Response): Promise<{ status: 'ok' }> {
    const rawToken = readSessionToken(request, this.sessionCookieName);
    if (rawToken) await this.prisma.adminSession.updateMany({ where: { tokenHash: hashSessionToken(rawToken), revokedAt: null }, data: { revokedAt: new Date() } });
    response.clearCookie(this.sessionCookieName, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
    response.clearCookie(AUTH_CSRF_COOKIE, { sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
    return { status: 'ok' };
  }

  async getAuthenticatedAdmin(request: Request): Promise<AuthenticatedAdmin | null> {
    const rawToken = readSessionToken(request, this.sessionCookieName);
    const requestIdHeader = request.headers['x-request-id'];
    const requestIdValue = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;
    const requestId = typeof requestIdValue === 'string' && /^[a-f0-9-]{36}$/i.test(requestIdValue) ? requestIdValue : 'unavailable';
    if (!rawToken) {
      this.logSessionDiagnostic({ requestId, path: request.path, status: 401, sessionCookiePresent: false });
      return null;
    }
    const session = await this.prisma.adminSession.findFirst({
      where: { tokenHash: hashSessionToken(rawToken), revokedAt: null, expiresAt: { gt: new Date() }, adminUser: { isActive: true } },
      include: { adminUser: { select: { id: true, email: true, role: true } } },
    });
    if (!session) {
      this.logSessionDiagnostic({ requestId, path: request.path, status: 401, sessionCookiePresent: true });
      return null;
    }
    this.logSessionDiagnostic({ requestId, path: request.path, status: 200, sessionCookiePresent: true });
    return { ...session.adminUser, sessionId: session.id };
  }

  private logSessionDiagnostic(data: { requestId: string; path: string; status: number; sessionCookiePresent: boolean }): void {
    if (this.authDiagnosticsEnabled) this.logger.log(JSON.stringify({ diagnostic: 'auth', stage: 'backend_session_verification', ...data }));
  }

  private setCookies(response: Response, sessionToken: string, csrfToken: string, expiresAt: Date): void {
    const secure = process.env.NODE_ENV === 'production';
    response.cookie(this.sessionCookieName, sessionToken, { httpOnly: true, secure, sameSite: 'lax', expires: expiresAt, path: '/' });
    response.cookie(AUTH_CSRF_COOKIE, csrfToken, { httpOnly: false, secure, sameSite: 'lax', expires: expiresAt, path: '/' });
  }

  private async assertLoginAllowed(key: string): Promise<void> {
    const attempt = await this.prisma.adminLoginAttempt.findUnique({ where: { key } });
    const now = Date.now();
    if (attempt?.blockedUntil && attempt.blockedUntil.getTime() > now) throw new HttpException('Too many login attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    if (attempt && now - attempt.windowStartedAt.getTime() > AUTH_LOGIN_WINDOW_MS) await this.prisma.adminLoginAttempt.update({ where: { key }, data: { attempts: 0, windowStartedAt: new Date(), blockedUntil: null } });
  }

  private async recordFailedLogin(key: string, adminUserId?: string): Promise<void> {
    const now = new Date();
    const attempt = await this.prisma.adminLoginAttempt.findUnique({ where: { key } });
    const attempts = attempt && now.getTime() - attempt.windowStartedAt.getTime() <= AUTH_LOGIN_WINDOW_MS ? attempt.attempts + 1 : 1;
    await this.prisma.adminLoginAttempt.upsert({
      where: { key },
      create: { key, attempts, adminUserId, blockedUntil: attempts >= AUTH_MAX_LOGIN_ATTEMPTS ? new Date(now.getTime() + AUTH_BLOCK_MS) : null },
      update: { attempts, windowStartedAt: attempts === 1 ? now : undefined, adminUserId, blockedUntil: attempts >= AUTH_MAX_LOGIN_ATTEMPTS ? new Date(now.getTime() + AUTH_BLOCK_MS) : null },
    });
  }
}
