import { Test, TestingModule } from '@nestjs/testing';
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

  it('should be defined', () => {
    expect(controller.v1()).toBeDefined();
  });
});
