import { ApiProperty } from '@nestjs/swagger';
import { FoundCompany } from './scraper.interface';

export class LookupRequest {
  @ApiProperty({
    description: 'The country code that this company is registered in.',
    example: 'CH',
  })
  readonly country: string;

  @ApiProperty({
    description: 'The tax id of the company',
    example: '123',
  })
  readonly taxId?: string;

  @ApiProperty({
    description: 'The name of the company.',
    example: 'Amazon',
  })
  readonly companyName?: string;
}

class ScraperLookupResponse {
  @ApiProperty({
    description: 'The name of the scraper that provided this data.',
    example: 'denmark-scraper',
  })
  readonly scraperName: string;

  @ApiProperty({
    description: 'The company metadata that was scraped.',
  })
  readonly companies: FoundCompany[];
}

export class LookupResponse {
  @ApiProperty({
    description: 'The companies found.',
  })
  readonly companies: ScraperLookupResponse[];

  @ApiProperty({
    description: 'Explanatory text about the response. If no companies were returned, describes the reason.',
  })
  readonly message: string;
}
