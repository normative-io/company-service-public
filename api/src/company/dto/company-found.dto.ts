import { ApiProperty } from '@nestjs/swagger';
import { Company } from '../company.model';

export class CompanyFoundDto {
  @ApiProperty({
    type: String,
    description: 'Information about how this company was found, for debugging',
    example: 'Repository',
    required: false,
  })
  readonly foundBy?: string;

  @ApiProperty({
    type: Number,
    description: 'A percentage value (as a value between 0.0 and 1.0) of how confident this data matches the request.',
    example: 0.5,
    required: false,
  })
  readonly confidence?: number;

  @ApiProperty({
    type: Company,
    description: 'Metadata about the company',
  })
  readonly company: Company;
}

export class ScraperServiceResponse {
  @ApiProperty({
    description: 'The companies found by the ScraperService.',
  })
  readonly companies: IndividualScraperResponse[];
}

export class IndividualScraperResponse {
  @ApiProperty({
    description: 'The name of the scraper that provided this data.',
    example: 'denmark-scraper',
    required: false,
  })
  readonly scraperName: string;

  @ApiProperty({
    description: 'The company metadata that was scraped.',
  })
  readonly companies: CompanyFoundDto[];
}
