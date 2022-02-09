import { Body, Controller, Post, Inject } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LookupRequest, LookupResponse } from '../dto/lookup.dto';
import { ScraperRegistry, SCRAPER_REGISTRY } from './registry.service';

@ApiTags('scraper')
@Controller('scraper')
export class ScraperController {
  constructor(
    @Inject(SCRAPER_REGISTRY)
    private readonly scraperRegistry: ScraperRegistry,
  ) {}

  @Post('lookup')
  @ApiOperation({ summary: 'Request on-demand lookup of a company.' })
  @ApiResponse({ type: LookupResponse })
  @ApiBody({ type: LookupRequest })
  async lookup(@Body() req: LookupRequest): Promise<LookupResponse> {
    return await this.scraperRegistry.lookup(req);
  }
}
