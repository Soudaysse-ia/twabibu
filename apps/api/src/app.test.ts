import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ApiErrorSchema, HealthSchema } from '@twabibu/contracts';
import { createApp } from './bootstrap.js';
import { loadConfig } from './config.js';

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
});
