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
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { LookupRequest } from 'src/dto/lookup.dto';
import { DenmarkScraper } from '.';
import * as response from './denmark-scraper.spec.response.json';

describe('DenmarkScraper', () => {
  let scraper: DenmarkScraper;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      controllers: [],
      providers: [DenmarkScraper],
    }).compile();

    scraper = app.get<DenmarkScraper>(DenmarkScraper);
  });

  it('should convert a VirkResponse to a FoundCompany', async () => {
    const request: LookupRequest = {
      country: 'DK',
      taxId: '37018848',
    };
    // @ts-expect-error: Response type is complex and may differ slightly
    expect(await scraper.toCompanies(request, response)).toEqual([
      {
        confidence: 1.0,
        company: {
          companyName: 'Meta Mind AB',
          isic: '6201',
          taxId: '37018848',
          country: 'DK',
        },
      },
    ]);
  });
});
