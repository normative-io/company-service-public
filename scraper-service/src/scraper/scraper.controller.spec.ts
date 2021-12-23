import { Test, TestingModule } from '@nestjs/testing';
import { FetchByCompanyIdDto } from './dto/fetch.dto';
import { ScraperController } from './scraper.controller';

describe('ScraperController', () => {
  let controller: ScraperController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ScraperController],
      providers: [],
    }).compile();

    controller = app.get<ScraperController>(ScraperController);
  });

  it('should fetch a company by companyId', () => {
    expect(controller.byCompanyId({ country: 'CH', companyId: '123' })).toEqual(
      { country: 'CH', companyId: '123' },
    );
  });
});
