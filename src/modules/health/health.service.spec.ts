import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('returns an ok API status', () => {
    const service = new HealthService({} as never);

    expect(service.getStatus()).toEqual({ status: 'ok' });
  });

  it('returns HTTP 503 when the database is unavailable', async () => {
    const service = new HealthService({
      $queryRaw: jest.fn().mockRejectedValue(new Error('unavailable')),
    } as never);

    await expect(service.getDatabaseStatus()).rejects.toThrow('Database is unavailable.');
  });
});
