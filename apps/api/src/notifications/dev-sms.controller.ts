import { Controller, Get, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';

/** Development only (fake providers): the last messages sent to an e-mail address or a phone number. */
@ApiExcludeController()
@Controller('v1/dev')
export class DevSmsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('messages')
  async last(@Query('to') to: string) {
    const rows = await this.prisma.notification.findMany({
      where: { recipient: { in: [String(to ?? '').trim(), String(to ?? '').trim().toLowerCase()] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { channel: true, template: true, payload: true, status: true, createdAt: true },
    });
    return rows.map((r) => {
      const p = r.payload as { text?: string; subject?: string };
      return { channel: r.channel, template: r.template, subject: p.subject ?? null, text: p.text, status: r.status, createdAt: r.createdAt };
    });
  }
}
