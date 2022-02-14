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
    expect(registry.applicableScrapers({ country: 'DK', companyId: '123' })).toEqual([[new DenmarkScraper()], []]);
  });

  it('should not use denmark-scraper to find a Swiss company', () => {
    expect(registry.applicableScrapers({ country: 'CH', companyId: '456' })).toEqual([
      [],
      ['denmark-scraper only applicable to country=DK'],
    ]);
  });
});
