import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ApiErrorSchema, HealthSchema } from '@twabibu/contracts';
import { createApp } from './bootstrap.js';
import { secondsToNextWindow } from './common/rate-limit.js';
import { loadConfig } from './config.js';
import { RedisService } from './redis/redis.service.js';

// Integration tests: need PostgreSQL (migrated + seeded) and Redis, as in .env.
describe('Twabibu API', () => {
  let app: INestApplication;

  before(async () => {
    app = await createApp(loadConfig({ ...process.env, NODE_ENV: 'test' }));
    await app.init();
  });
  after(async () => {
    await app?.close();
  });

  it('answers /health and /ready with database and Redis up', async () => {
    await request(app.getHttpServer()).get('/health').expect(200, { status: 'ok' });
    const res = await request(app.getHttpServer()).get('/ready').expect(200);
    const health = HealthSchema.parse(res.body);
    assert.deepEqual(health.checks, { database: true, redis: true });
  });

  it('refuses a write sent by another web site (SEC-03)', async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' });
    const refused = await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .set('Origin', 'https://evil.example')
      .send({ email: 'csrf@example.com' })
      .expect(403);
    assert.equal(ApiErrorSchema.parse(refused.body).code, 'FORBIDDEN');
    // The site's own origin goes through to validation.
    await request(app.getHttpServer()).post('/v1/auth/otp/request').set('Origin', new URL(config.APP_URL).origin).send({}).expect(400);
  });

  it('limits public reads per address and says when to retry', async () => {
    const redis = app.get(RedisService).client;
    const clear = async () => {
      const keys = await redis.keys('twabibu:rl:prescriptionCheck:*');
      if (keys.length) await redis.del(...keys);
    };
    await clear();
    // Counters reset every minute: start early in a window so the 31 requests below all land in the same one.
    const left = secondsToNextWindow(Date.now());
    if (left < 15) await new Promise((r) => setTimeout(r, left * 1000 + 100));
    try {
      const server = app.getHttpServer();
      // Two visitors behind the site: each has its own counter (X-Forwarded-For is trusted from private addresses only).
      for (let i = 0; i < 30; i++) await request(server).get('/v1/o/ZZZZZZZZZZ').set('X-Forwarded-For', '41.1.2.3').expect(404);
      const limited = await request(server).get('/v1/o/ZZZZZZZZZZ').set('X-Forwarded-For', '41.1.2.3').expect(429);
      assert.equal(ApiErrorSchema.parse(limited.body).code, 'RATE_LIMITED');
      assert.ok(Number(limited.headers['retry-after']) >= 1);
      await request(server).get('/v1/o/ZZZZZZZZZZ').set('X-Forwarded-For', '41.9.9.9').expect(404);
    } finally {
      await clear();
    }
  });

  it('serves the three islands and the seeded localities', async () => {
    const islands = await request(app.getHttpServer()).get('/v1/directory/islands').expect(200);
    assert.deepEqual(islands.body.map((i: { slug: string }) => i.slug).sort(), ['mwali', 'ndzuani', 'ngazidja']);
    const mwali = await request(app.getHttpServer()).get('/v1/directory/localities?island=mwali').expect(200);
    assert.ok(mwali.body.some((l: { slug: string }) => l.slug === 'fomboni'));
    assert.ok(mwali.body.every((l: { island: string }) => l.island === 'MWALI'));
  });

  it('suggests specialities and places without accents or capitals', async () => {
    const what = await request(app.getHttpServer()).get('/v1/search/suggest?q=pedi').expect(200);
    assert.equal(what.body.specialities[0]?.slug, 'pediatre');
    const where = await request(app.getHttpServer()).get('/v1/search/places?q=MORO').expect(200);
    assert.equal(where.body.localities[0]?.slug, 'moroni');
    const anjouan = await request(app.getHttpServer()).get('/v1/search/places?q=anjouan').expect(200);
    assert.deepEqual(anjouan.body.islands[0], { slug: 'ndzuani', name: 'Ndzuani', frenchName: 'Anjouan' });
    const empty = await request(app.getHttpServer()).get('/v1/search/suggest?q=p').expect(200);
    assert.deepEqual(empty.body, { specialities: [], practitioners: [] });
  });

  it('returns typed errors', async () => {
    const tooLong = await request(app.getHttpServer()).get(`/v1/search/suggest?q=${'a'.repeat(81)}`).expect(400);
    assert.equal(ApiErrorSchema.parse(tooLong.body).code, 'VALIDATION_FAILED');
    const missing = await request(app.getHttpServer()).get('/v1/nothing-here').expect(404);
    assert.equal(ApiErrorSchema.parse(missing.body).code, 'NOT_FOUND');
  });

  it('publishes the OpenAPI document', async () => {
    const res = await request(app.getHttpServer()).get('/v1/docs-json').expect(200);
    assert.equal(res.body.info.title, 'Twabibu API');
    assert.ok(res.body.paths['/v1/search/suggest']);
  });

  it('keeps the documentation private in production', async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test', APP_ENV: 'production', EMAIL_PROVIDER: 'brevo', EMAIL_API_KEY: 'test-only' });
    const production = await createApp(config);
    await production.init();
    try {
      await request(production.getHttpServer()).get('/v1/docs-json').expect(404);
      await request(production.getHttpServer()).get('/v1/docs').expect(404);
    } finally {
      await production.close();
    }
  });
});
