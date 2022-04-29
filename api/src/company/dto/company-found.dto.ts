// Copyright 2022 Meta Mind AB
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
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

  @ApiProperty({
    description: 'Explanatory text about the response. If no companies were returned, describes the reason.',
  })
  readonly message: string;
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
