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
