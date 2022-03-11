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
import { Module } from '@nestjs/common';
import { ScraperRegistry, SCRAPER_REGISTRY } from './registry.service';
import { ScraperController } from './scraper.controller';
import { PrometheusModule, makeCounterProvider } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [ConfigModule, PrometheusModule.register()],
  controllers: [ScraperController],
  providers: [
    {
      provide: SCRAPER_REGISTRY,
      useClass: ScraperRegistry,
    },
    makeCounterProvider({
      name: 'lookup_inbound_total',
      help: 'The number of lookup inbound requests to the ScraperService',
      labelNames: ['country'],
    }),
    makeCounterProvider({
      name: 'lookup_inbound_by_scraper_total',
      help: 'The number of lookup inbound requests for individual scrapers',
      // Note: `lookup_inbound_total` is incremented once per request to the service;
      // `lookup_inbound_by_scraper_total` is incremented once for every time we
      // send the request to a scraper. One request to the service can lead to
      // one or more requests to scrapers.
      // We could use a single metric instead of two by distinguishing the
      // instances with and without scraperName, however this can very easily lead to
      // over counting of inbound requests.
      // Also, we could care only about `lookup_inbound_by_scraper_total`, but we would
      // miss requests that are rejected because they are invalid, or request
      // that don't apply to any scraper.
      labelNames: ['country', 'scraper_name'],
    }),
    makeCounterProvider({
      name: 'lookup_found_total',
      help: 'The number of lookup requests that are answered',
      labelNames: ['country', 'scraper_name'],
    }),
    makeCounterProvider({
      name: 'lookup_not_found_total',
      help: 'The number of lookup requests for which no results are found',
      labelNames: ['country', 'reason'],
    }),
    makeCounterProvider({
      name: 'lookup_error_total',
      help: 'The number of lookup requests for which the Scraper Service throws an error',
      // Note, 'scraperName' might not be present if the error happened outside a scraper.
      labelNames: ['country', 'status_code', 'scraper_name'],
    }),
  ],
})
export class ScraperModule {}
