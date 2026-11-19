import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { Health } from '@twabibu/contracts';
import { API_VERSION } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('health')
  @HttpCode(200)
  @ApiOperation({ summary: 'Liveness: the process answers.' })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness: database and Redis reachable. 503 otherwise.' })
  async ready(@Res({ passthrough: true }) res: Response): Promise<Health> {
    const [database, redis] = await Promise.all([this.prisma.isHealthy(), this.redis.isHealthy()]);
    const status = database && redis ? 'ok' : 'degraded';
    if (status !== 'ok') res.status(503);
    return { status, version: API_VERSION, checks: { database, redis }, time: new Date().toISOString() };
  }
}
