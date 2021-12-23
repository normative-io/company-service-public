import { Body, Controller, Get } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FetchByCompanyIdDto } from './dto/fetch.dto';

@ApiTags('scraper')
@Controller('scraper')
export class ScraperController {
  @Get('fetch/byCompanyId')
  @ApiOperation({ summary: 'Request on-demand lookup by company id.' })
  @ApiResponse({ description: 'The metadata of the matching company.' })
  @ApiBody({ type: FetchByCompanyIdDto, description: 'The new company' })
  byCompanyId(@Body() company: FetchByCompanyIdDto) {
    // TODO: implement fetching via registered scrapers.
    return { country: company.country, companyId: company.companyId };
  }
}
