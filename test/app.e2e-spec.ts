import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

describe('Health endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health', async () => {
    const server = app.getHttpServer() as unknown as Server;
    await request(server).get('/api/v1/health').expect(200).expect({ status: 'ok' });
  });

  it('does not expose unauthenticated media mutation routes', async () => {
    const server = app.getHttpServer() as unknown as Server;
    await request(server).post('/api/v1/media/upload').expect(404);
    await request(server).delete('/api/v1/media/interior-portfolio%2Fexample').expect(404);
  });
});
