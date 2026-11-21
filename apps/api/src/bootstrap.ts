import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { csrfMiddleware, originsFrom } from './common/csrf.js';
import { AllExceptionsFilter } from './common/http-exception.filter.js';
import { API_VERSION, loadConfig, type AppConfig } from './config.js';

/** Builds the HTTP application. Shared by main.ts and the integration tests. */
export async function createApp(config: AppConfig = loadConfig()): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), { logger: config.NODE_ENV === 'test' ? false : undefined });
  // The API is only reachable from the private Docker network (ADR-020): Caddy writes the visitor's address in
  // X-Forwarded-For and the site passes it on. Trust that header from private addresses only, so req.ip (audit log,
  // sessions) is the visitor and not the site's container. Never publish the API port directly.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.use(csrfMiddleware(originsFrom([config.APP_URL, config.ADMIN_URL])));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({ origin: [config.APP_URL], credentials: true });
  app.enableShutdownHooks();

  // The interactive documentation lists every route and its fields: useful locally and on the demo, a free map for
  // an attacker in production. The site and the back-office do not need it.
  if (config.APP_ENV !== 'production') {
    const openapi = new DocumentBuilder()
      .setTitle('Twabibu API')
      .setDescription('API de la plateforme Twabibu. Référence : docs/03-architecture/api.md')
      .setVersion(API_VERSION)
      .build();
    SwaggerModule.setup('v1/docs', app, () => SwaggerModule.createDocument(app, openapi));
  }
  return app;
}
