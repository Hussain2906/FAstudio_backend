import type { Request } from 'express';
import { createFirebaseSessionCookieValue, readCsrfToken, readSessionToken } from './auth.cookies.js';

function requestWithCookie(cookie?: string): Request {
  return { headers: cookie ? { cookie } : {} } as Request;
}

describe('Firebase Hosting session cookie compatibility', () => {
  it('resolves session and CSRF tokens from the only cookie Firebase Hosting forwards', () => {
    const sessionToken = 'session_token-safe';
    const csrfToken = 'csrf_token-safe';
    const request = requestWithCookie(`__session=${createFirebaseSessionCookieValue(sessionToken, csrfToken)}`);

    expect(readSessionToken(request)).toBe(sessionToken);
    expect(readCsrfToken(request, 'fs_admin_csrf')).toBe(csrfToken);
  });

  it('keeps local named session and CSRF cookies working', () => {
    const request = requestWithCookie('fs_admin_session=local_session; fs_admin_csrf=local_csrf');

    expect(readSessionToken(request)).toBe('local_session');
    expect(readCsrfToken(request, 'fs_admin_csrf')).toBe('local_csrf');
  });

  it('rejects malformed Firebase cookie values instead of treating them as valid tokens', () => {
    const request = requestWithCookie('__session=malformed');

    expect(readSessionToken(request)).toBeUndefined();
    expect(readCsrfToken(request, 'fs_admin_csrf')).toBeUndefined();
  });
});
