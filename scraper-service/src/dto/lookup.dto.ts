import { ApiProperty } from '@nestjs/swagger';
import { FoundCompany } from './scraper.interface';

export class LookupRequest {
  @ApiProperty({
    description: 'The country code that this company is registered in.',
    example: 'CH',
  })
  readonly country: string;

  @ApiProperty({
    description: 'The identifier for the company (ex: VAT, EIN, etc..)',
    example: '123',
  })
  readonly companyId?: string;

  @ApiProperty({
    description: 'The name of the company.',
    example: 'Amazon',
  })
  readonly companyName?: string;
}

export class LookupResponse {
  @ApiProperty({
    description: 'The name of the scraper that provided this data.',
    example: 'denmark-scraper',
  })
  readonly scraperName: string;

  @ApiProperty({
    description: 'The company metadata that was scraped.',
  })
  readonly foundCompanies: FoundCompany[];
}
