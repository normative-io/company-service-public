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
      labelNames: ['country', 'scraperName'],
    }),
    makeCounterProvider({
      name: 'lookup_outbound_found_total',
      help: 'The number of lookup requests that are answered',
      labelNames: ['country', 'scraperName'],
    }),
    makeCounterProvider({
      name: 'lookup_outbound_not_found_total',
      help: 'The number of lookup requests for which no results are found',
      labelNames: ['country'],
    }),
    makeCounterProvider({
      name: 'lookup_error_total',
      help: 'The number of lookup requests for which the Scraper Service throws an error',
      // Note, 'scraperName' might not be present if the error happened outside a scraper.
      labelNames: ['country', 'statusCode', 'scraperName'],
    }),
  ],
})
export class ScraperModule {}
