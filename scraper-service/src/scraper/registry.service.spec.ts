import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DenmarkScraper } from './examples/denmark-scraper';
import { ScraperRegistry } from './registry.service';

describe('ScraperRegistry', () => {
  let registry: ScraperRegistry;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      controllers: [],
      providers: [ScraperRegistry],
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
