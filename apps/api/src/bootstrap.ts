import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/http-exception.filter.js';
import { API_VERSION, loadConfig, type AppConfig } from './config.js';

/** Builds the HTTP application. Shared by main.ts and the integration tests. */
export async function createApp(config: AppConfig = loadConfig()): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.forRoot(config), { logger: config.NODE_ENV === 'test' ? false : undefined });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({ origin: [config.APP_URL], credentials: true });
  app.enableShutdownHooks();

  const openapi = new DocumentBuilder()
    .setTitle('Twabibu API')
    .setDescription('API de la plateforme Twabibu. Référence : docs/03-architecture/api.md')
    .setVersion(API_VERSION)
    .build();
  SwaggerModule.setup('v1/docs', app, () => SwaggerModule.createDocument(app, openapi));
  return app;
}
