import { Test, TestingModule } from '@nestjs/testing';
import { ScraperRegistry, SCRAPER_REGISTRY } from './registry.service';
import { ScraperController } from './scraper.controller';

describe('ScraperController', () => {
  let controller: ScraperController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
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

  it('should fetch a company by companyId', () => {
    expect(controller.byCompanyId({ country: 'CH', companyId: '123' })).toEqual(
      [{ confidence: 1.0, name: 'some-company-name' }],
    );
  });
});
