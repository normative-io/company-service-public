import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ScraperRegistry, SCRAPER_REGISTRY } from './registry.service';
import { ScraperController } from './scraper.controller';

describe('ScraperController', () => {
  let controller: ScraperController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      controllers: [ScraperController],
      providers: [
        {
          provide: SCRAPER_REGISTRY,
          useClass: ScraperRegistry,
        },
      ],
    }).compile();

    controller = app.get<ScraperController>(ScraperController);
  });

  it('should find a Danish company by companyId', () => {
    expect(controller.byCompanyId({ country: 'DK', companyId: '123' })).toEqual(
      [{ confidence: 1.0, name: 'danish-company-123' }],
    );
  });

  it('should not find a Swiss company by companyId', () => {
    expect(controller.byCompanyId({ country: 'CH', companyId: '456' })).toEqual(
      [],
    );
  });
});
