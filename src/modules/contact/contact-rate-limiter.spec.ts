import { HttpException } from '@nestjs/common';
import { ContactRateLimiter } from './contact-rate-limiter.js';

describe('ContactRateLimiter', () => {
  it('limits repeated contact requests by hashed client address', () => {
    const limiter = new ContactRateLimiter();
    for (let attempt = 0; attempt < 5; attempt += 1) limiter.consume('203.0.113.10');

    try {
      limiter.consume('203.0.113.10');
      throw new Error('Expected the sixth request to be rejected.');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    }
  });

  it('tracks a different address independently', () => {
    const limiter = new ContactRateLimiter();
    for (let attempt = 0; attempt < 5; attempt += 1) limiter.consume('203.0.113.10');
    expect(() => limiter.consume('203.0.113.11')).not.toThrow();
  });
});
