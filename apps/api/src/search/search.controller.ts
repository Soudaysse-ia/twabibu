import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { SearchService } from './search.service.js';

const QuerySchema = z.object({ q: z.string().trim().max(80).default('') });

@ApiTags('search')
@Controller('v1/search')
@RateLimit('autocomplete')
@UseGuards(RateLimitGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('suggest')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiQuery({ name: 'q', description: 'Au moins 2 caractères' })
  @ApiOperation({ summary: 'Autocomplétion du champ « quoi » : spécialités et soignants.' })
  suggest(@Query(new ZodValidationPipe(QuerySchema)) query: z.infer<typeof QuerySchema>) {
    return this.search.suggest(query.q);
  }

  @Get('places')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiQuery({ name: 'q', description: 'Au moins 2 caractères' })
  @ApiOperation({ summary: 'Autocomplétion du champ « où » : îles et localités.' })
  places(@Query(new ZodValidationPipe(QuerySchema)) query: z.infer<typeof QuerySchema>) {
    return this.search.places(query.q);
  }
}
