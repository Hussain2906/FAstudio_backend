import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { AUTH_SESSION_COOKIE } from './auth.constants.js';

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
  return readCookie(request, name);
}
