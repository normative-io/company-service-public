import { Body, Controller, Post, Inject } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LookupRequest } from '../dto/lookup.dto';
import { ScraperRegistry, SCRAPER_REGISTRY } from './registry.service';

@ApiTags('scraper')
@Controller('scraper')
export class ScraperController {
  constructor(
    @Inject(SCRAPER_REGISTRY)
    private readonly scraperRegistry: ScraperRegistry,
  ) {}

  @Post('lookup')
  @ApiOperation({ summary: 'Request on-demand lookup by company id.' })
  @ApiResponse({ description: 'The metadata of the matching company.' })
  @ApiBody({ type: LookupRequest, description: 'The new company' })
  async lookup(@Body() req: LookupRequest) {
    return await this.scraperRegistry.fetch(req);
  }
}
