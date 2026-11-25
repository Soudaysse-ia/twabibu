import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import type { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { loggedPath, requestIdFrom, requestLog } from './request-log.js';

// Request log (INFRA-05): an id to follow a request, and nothing personal in the line.
describe('Request log', () => {
  it('reuses a clean incoming id and makes one otherwise', () => {
    assert.equal(requestIdFrom('a1b2c3d4-e5f6'), 'a1b2c3d4-e5f6');
    for (const bad of [undefined, 'short', 'with space injected', 'x'.repeat(65), 'line\nbreak'])
      assert.match(requestIdFrom(bad), /^[0-9a-f-]{36}$/);
  });

  it('writes the route template, never the real path or the query string', () => {
    assert.equal(
      loggedPath({
        baseUrl: '',
        path: '/v1/pro/invitations/abcDEF123secret',
        route: { path: '/v1/pro/invitations/:token' },
      }),
      '/v1/pro/invitations/:token',
    );
    // No route matched (404): anything that could be an id, a token or a name is hidden.
    assert.equal(
      loggedPath({ baseUrl: '', path: '/v1/patients/0195f0e2-aaaa-7bbb-8ccc-123456789abc/notes' }),
      '/v1/patients/:x/notes',
    );
    assert.equal(
      loggedPath({ baseUrl: '', path: '/medecin-generaliste/moroni/Amina.Said' }),
      '/medecin-generaliste/moroni/:x',
    );
  });

  it('sends the id back, logs once when the answer is sent, warns on errors, skips health checks', () => {
    const lines: [string, string][] = [];
    const logger = {
      log: (m: string) => lines.push(['log', m]),
      warn: (m: string) => lines.push(['warn', m]),
      error: (m: string) => lines.push(['error', m]),
    } as unknown as Logger;
    const middleware = requestLog(logger);
    const call = (path: string, status: number, route?: string) => {
      const res = Object.assign(new EventEmitter(), {
        locals: {} as Record<string, unknown>,
        statusCode: status,
        headers: {} as Record<string, string>,
        setHeader(k: string, v: string) {
          this.headers[k] = v;
        },
      });
      const req = {
        method: 'GET',
        headers: { 'x-request-id': 'req-12345678' },
        baseUrl: '',
        path,
        route: route ? { path: route } : undefined,
      } as unknown as Request;
      middleware(req, res as unknown as Response, (() => undefined) as NextFunction);
      res.emit('finish');
      return res;
    };
    const res = call('/v1/search/practitioners', 200, '/v1/search/practitioners');
    assert.equal(res.headers['X-Request-Id'], 'req-12345678');
    call('/v1/ready', 200, '/v1/ready');
    call('/v1/pro/orgs/x/setup', 500, '/v1/pro/orgs/:orgId/setup');
    call('/v1/me/relatives', 409, '/v1/me/relatives');
    assert.deepEqual(
      lines.map(([level]) => level),
      ['log', 'error', 'warn'],
    );
    assert.match(lines[1]![1], /^GET \/v1\/pro\/orgs\/:orgId\/setup 500 \d+ms id=req-12345678$/);
  });
});
