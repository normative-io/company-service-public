import { Body, Controller, Get, Inject } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FetchByCompanyIdDto } from '../dto/fetch.dto';
import { ScraperRegistry, SCRAPER_REGISTRY } from './registry.service';

@ApiTags('scraper')
@Controller('scraper')
export class ScraperController {
  constructor(
    @Inject(SCRAPER_REGISTRY)
    private readonly scraperRegistry: ScraperRegistry,
  ) {}

  @Get('fetch/byCompanyId')
  @ApiOperation({ summary: 'Request on-demand lookup by company id.' })
  @ApiResponse({ description: 'The metadata of the matching company.' })
  @ApiBody({ type: FetchByCompanyIdDto, description: 'The new company' })
  byCompanyId(@Body() company: FetchByCompanyIdDto) {
    return this.scraperRegistry.fetch(company);
  }
}
