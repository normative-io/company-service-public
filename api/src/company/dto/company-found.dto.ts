import { ApiProperty } from '@nestjs/swagger';
import { Company } from '../company.model';
import { CreateCompanyDto } from './create-company.dto';

class CompanyFoundDto {
  @ApiProperty({
    type: String,
    description: 'Information about how this company was found, for debugging',
    example: 'Repository',
  })
  readonly foundBy?: string;

  @ApiProperty({
    type: Number,
    description: 'A percentage value (as a value between 0.0 and 1.0) of how confident this data matches the request.',
    example: 0.5,
  })
  readonly confidence?: number;
}

export class CompanyFoundInScraperDto extends CompanyFoundDto {
  @ApiProperty({
    type: Company,
    description: 'Metadata about the company',
  })
  readonly company: CreateCompanyDto;

  @ApiProperty({
    type: String,
    description: 'The name of the scraper that found the company',
  })
  readonly scraperName?: string;
}

export class CompanyFoundInRepositoryDto extends CompanyFoundDto {
  @ApiProperty({
    type: Company,
    description: 'The company',
  })
  readonly company: Company;
}

export class CompanyFoundInServiceDto extends CompanyFoundInRepositoryDto {}
