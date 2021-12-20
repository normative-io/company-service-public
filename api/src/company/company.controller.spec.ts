import { Test, TestingModule } from '@nestjs/testing';
import { CompanyController } from './company.controller';

describe('CompanyController', () => {
  let controller: CompanyController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [CompanyController],
      providers: [],
    }).compile();

    controller = app.get<CompanyController>(CompanyController);
  });

  it('should be defined', () => {
    expect(controller.v1()).toBeDefined();
  });
});
