import { getRateLimitClientIp } from './get-rate-limit-client-ip.js';

describe('getRateLimitClientIp', () => {
  it('uses a valid Railway X-Real-IP only when explicitly trusted', () => {
    const request = { ip: '10.0.0.1', headers: { 'x-real-ip': '198.51.100.22' } };

    expect(getRateLimitClientIp(request, true)).toBe('198.51.100.22');
    expect(getRateLimitClientIp(request, false)).toBe('10.0.0.1');
  });

  it('falls back to Express IP for invalid or absent Railway headers', () => {
    expect(getRateLimitClientIp({ ip: '10.0.0.2', headers: { 'x-real-ip': 'not-an-ip' } }, true)).toBe('10.0.0.2');
    expect(getRateLimitClientIp({ headers: {} }, true)).toBe('unknown');
  });
});
