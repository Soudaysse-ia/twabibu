import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ApiErrorSchema } from '@twabibu/contracts';
import { createApp } from './bootstrap.js';
import { loadConfig } from './config.js';
import { isRobot } from './contact/contact-rules.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RedisService } from './redis/redis.service.js';

// Contact form (WEB-02). Needs PostgreSQL and Redis, as in .env.
describe('Contact form', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const config = loadConfig({ ...process.env, NODE_ENV: 'test' });
  const sender = `contact-${Date.now()}@example.com`;
  const valid = {
    name: 'Fatima Ali',
    email: sender,
    topic: 'PATIENT',
    message: 'Bonjour,\nje ne trouve pas mon rendez-vous de mardi.',
  };

  before(async () => {
    app = await createApp(config);
    await app.init();
    prisma = app.get(PrismaService);
  });
  // Every request here comes from the same local address: reset the counters so tests (and later runs) start clean.
  const resetLimits = async () => {
    const redis = app.get(RedisService).client;
    const keys = await redis.keys('twabibu:contact-rate:*');
    if (keys.length) await redis.del(...keys);
  };
  beforeEach(resetLimits);
  after(async () => {
    if (app) await resetLimits();
    await prisma?.notification.deleteMany({
      where: { template: 'contact.message', recipient: config.SUPPORT_EMAIL },
    });
    await app?.close();
  });

  it('spots the honeypot only when it is filled in', () => {
    assert.equal(isRobot(undefined), false);
    assert.equal(isRobot('  '), false);
    assert.equal(isRobot('https://spam.example'), true);
  });

  it('sends the message to support, escaped, and never to the sender', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/contact')
      .send({ ...valid, message: 'Bonjour, <script>alert(1)</script> merci & bonne journée.' })
      .expect(202);
    assert.deepEqual(res.body, { status: 'RECEIVED' });
    const sent = await prisma.notification.findFirst({
      where: { template: 'contact.message' },
      orderBy: { createdAt: 'desc' },
    });
    assert.equal(sent?.recipient, config.SUPPORT_EMAIL);
    assert.equal(sent?.channel, 'EMAIL');
    const payload = sent?.payload as { subject: string; html: string; text: string };
    assert.equal(payload.subject, 'Contact (Patient) : Fatima Ali');
    assert.ok(payload.html.includes('&lt;script&gt;alert(1)&lt;/script&gt; merci &amp; bonne'));
    assert.ok(!payload.html.includes('<script>'));
    assert.ok(payload.text.includes(sender));
    assert.equal(await prisma.notification.count({ where: { recipient: sender } }), 0);
  });

  it('refuses incomplete or malformed messages', async () => {
    const server = app.getHttpServer();
    for (const body of [
      {},
      { ...valid, email: 'pas-une-adresse' },
      { ...valid, topic: 'ADMIN' },
      { ...valid, message: 'Court' },
      { ...valid, message: 'x'.repeat(3001) },
      { ...valid, name: 'Fatima\r\nBcc: victime@example.com' },
    ]) {
      const res = await request(server).post('/v1/contact').send(body).expect(400);
      assert.equal(ApiErrorSchema.parse(res.body).code, 'VALIDATION_FAILED');
    }
  });

  it('accepts a robot silently without sending anything', async () => {
    const before = await prisma.notification.count({ where: { template: 'contact.message' } });
    await request(app.getHttpServer())
      .post('/v1/contact')
      .send({ ...valid, website: 'https://spam.example' })
      .expect(202);
    assert.equal(await prisma.notification.count({ where: { template: 'contact.message' } }), before);
  });

  it('limits messages per e-mail address and per network address', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 3; i++) await request(server).post('/v1/contact').send(valid).expect(202);
    const limited = await request(server).post('/v1/contact').send(valid).expect(429);
    assert.equal(ApiErrorSchema.parse(limited.body).code, 'RATE_LIMITED');
    // The refused attempt counted too (4 from this network): one more address goes through, then the network is limited.
    await request(server)
      .post('/v1/contact')
      .send({ ...valid, email: `other-${sender}` })
      .expect(202);
    await request(server)
      .post('/v1/contact')
      .send({ ...valid, email: `last-${sender}` })
      .expect(429);
  });
});
