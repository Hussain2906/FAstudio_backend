import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Express } from 'express';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  if (config.get<boolean>('TRUST_PROXY', false)) {
    // Use only when the API is private behind exactly one trusted reverse proxy.
    const expressApp = app.getHttpAdapter().getInstance() as Express;
    expressApp.set('trust proxy', 1);
  }

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({
    credentials: true,
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      const allowedOrigins = [config.getOrThrow<string>('STOREFRONT_URL'), config.getOrThrow<string>('ADMIN_URL')];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS'));
    },
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  if (config.get<boolean>('SWAGGER_ENABLED')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('E-commerce API')
      .setDescription('Shared backend API for the storefront and admin applications.')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(config.get<number>('PORT', 4000));
}
await bootstrap();
