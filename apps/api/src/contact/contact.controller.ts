import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ContactRequestSchema, type ContactRequest } from '@twabibu/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ContactService } from './contact.service.js';

@ApiTags('contact')
@Controller('v1/contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Envoie un message au support Twabibu (5 messages par heure et par adresse IP, 3 par e-mail).',
  })
  async send(
    @Body(new ZodValidationPipe(ContactRequestSchema)) body: ContactRequest,
    @Req() req: Request,
  ): Promise<{ status: 'RECEIVED' }> {
    await this.contact.send(body, req.ip);
    return { status: 'RECEIVED' };
  }
}
