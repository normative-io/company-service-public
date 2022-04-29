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
import { DenmarkScraper } from './examples/denmark-scraper';
import { ScraperRegistry } from './registry.service';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { TestMetrics } from './test-utils/company-service-metrics';

describe('ScraperRegistry', () => {
  let registry: ScraperRegistry;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [PrometheusModule, ConfigModule.forRoot()],
      controllers: [],
      providers: [ScraperRegistry, ...TestMetrics],
    }).compile();

    registry = app.get<ScraperRegistry>(ScraperRegistry);
  });

  it('should use denmark-scraper to find a Danish company ', () => {
    expect(registry.applicableScrapers({ country: 'DK', taxId: '123' })).toEqual([[new DenmarkScraper()], []]);
  });

  it('should not use denmark-scraper to find a Swiss company', () => {
    expect(registry.applicableScrapers({ country: 'CH', taxId: '456' })).toEqual([
      [],
      ['denmark-scraper only applicable to country=DK'],
    ]);
  });
});
