import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { AUTH_SESSION_COOKIE } from './auth.constants.js';

export const FIREBASE_SESSION_COOKIE = '__session';

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  const pair = header.split(';').find((value) => value.trim().startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.trim().slice(name.length + 1)) : undefined;
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function readSessionToken(request: Request, name = AUTH_SESSION_COOKIE): string | undefined {
  const regularToken = readCookie(request, name);
  if (regularToken) return regularToken;
  return getFirebaseSessionParts(request)?.sessionToken;
}

export function readCsrfToken(request: Request, name: string): string | undefined {
  const regularToken = readCookie(request, name);
  if (regularToken) return regularToken;
  return getFirebaseSessionParts(request)?.csrfToken;
}

export function createFirebaseSessionCookieValue(sessionToken: string, csrfToken: string): string {
  return `${sessionToken}.${csrfToken}`;
}

function getFirebaseSessionParts(request: Request): { sessionToken: string; csrfToken: string } | undefined {
  const value = readCookie(request, FIREBASE_SESSION_COOKIE);
  if (!value) return undefined;
  const separator = value.indexOf('.');
  if (separator <= 0 || separator === value.length - 1) return undefined;
  const sessionToken = value.slice(0, separator);
  const csrfToken = value.slice(separator + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(sessionToken) || !/^[A-Za-z0-9_-]+$/.test(csrfToken)) return undefined;
  return { sessionToken, csrfToken };
}
