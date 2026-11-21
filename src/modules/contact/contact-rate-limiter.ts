import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_KEYS = 10_000;

type AttemptWindow = { count: number; expiresAt: number };

@Injectable()
export class ContactRateLimiter {
  private readonly attempts = new Map<string, AttemptWindow>();

  consume(ipAddress: string): void {
    const now = Date.now();
    const key = createHash('sha256').update(ipAddress || 'unknown').digest('hex');
    const current = this.attempts.get(key);

    if (!current || current.expiresAt <= now) {
      this.attempts.set(key, { count: 1, expiresAt: now + WINDOW_MS });
      this.prune(now);
      return;
    }

    if (current.count >= MAX_ATTEMPTS) {
      throw new HttpException('Please wait before sending another enquiry.', HttpStatus.TOO_MANY_REQUESTS);
    }

    current.count += 1;
  }

  private prune(now: number): void {
    if (this.attempts.size <= MAX_KEYS) return;
    for (const [key, window] of this.attempts) {
      if (window.expiresAt <= now || this.attempts.size > MAX_KEYS) this.attempts.delete(key);
    }
  }
}
