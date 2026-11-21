import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.js';
import { DirectoryService } from './directory.service.js';

@ApiTags('directory')
@Controller('v1/directory')
@RateLimit('publicRead')
@UseGuards(RateLimitGuard)
export class DirectoryController {
  constructor(private readonly directory: DirectoryService) {}

  @Get('islands')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({ summary: 'Les trois îles.' })
  islands() {
    return this.directory.islands();
  }

  @Get('localities')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiQuery({ name: 'island', required: false, description: 'Slug de l’île : ngazidja, ndzuani, mwali' })
  @ApiOperation({ summary: 'Localités actives, éventuellement filtrées par île.' })
  localities(@Query('island') island?: string) {
    return this.directory.localities(island);
  }

  @Get('specialities')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({ summary: 'Spécialités actives.' })
  specialities() {
    return this.directory.specialities();
  }
}
