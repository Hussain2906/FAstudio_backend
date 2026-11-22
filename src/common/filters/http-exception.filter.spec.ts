import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { HttpExceptionFilter } from './http-exception.filter.js';

function createHost() {
    const json = jest.fn<void, [Record<string, unknown>]>();
    const status = jest.fn<{ json: typeof json }, [number]>().mockReturnValue({ json });
  const response = { status } as unknown as Response;
  const request = { url: '/api/v1/auth/login' } as Request;
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    loggerError.mockRestore();
  });

  it('logs sanitized details for unexpected 500 errors and preserves the response', () => {
    const filter = new HttpExceptionFilter();
    const { host, status, json } = createHost();
    const error = new Error(
      'Login failed password=hunter2 DATABASE_URL=postgresql://dbuser:dbpass@db.example/app token=secret-token',
    );
    error.stack = `${error.name}: ${error.message}\n at auth (Bearer abc.def.ghi)`;

    filter.catch(error, host);

    expect(loggerError).toHaveBeenCalledTimes(1);
    const calls = loggerError.mock.calls as unknown as Array<[unknown]>;
    const logValue = calls[0]?.[0];
    const log = typeof logValue === 'string' ? logValue : '';
    expect(log).toContain('"exceptionType":"Error"');
    expect(log).toContain('[REDACTED]');
    for (const secret of ['hunter2', 'dbuser', 'dbpass', 'secret-token', 'abc.def.ghi']) {
      expect(log).not.toContain(secret);
    }
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      path: '/api/v1/auth/login',
    }));
    expect(typeof json.mock.calls[0]?.[0]?.timestamp).toBe('string');
  });

  it('does not log expected HTTP errors and preserves their response', () => {
    const filter = new HttpExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new HttpException('Invalid email or password.', HttpStatus.UNAUTHORIZED), host);

    expect(loggerError).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: HttpStatus.UNAUTHORIZED,
      message: 'Invalid email or password.',
      path: '/api/v1/auth/login',
    }));
    expect(typeof json.mock.calls[0]?.[0]?.timestamp).toBe('string');
  });
});
