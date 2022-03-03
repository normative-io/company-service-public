import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { MongoRepositoryModule } from './repository/mongo/mongo.module';
import { MongoRepositoryService } from './repository/mongo/mongo.service';
import { COMPANY_REPOSITORY } from './repository/repository-interface';
import { TestMetrics } from './test-utils/company-service-metrics';
import { getConnectionToken } from '@nestjs/mongoose';

describe('CompanyController', () => {
  let controller: CompanyController;
  let mongoServer: MongoMemoryServer;
  let mongoConnection: Connection;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongoServer.getUri();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule, ConfigModule.forRoot(), MongoRepositoryModule],
      controllers: [CompanyController],
      providers: [
        CompanyService,
        {
          provide: COMPANY_REPOSITORY,
          useClass: MongoRepositoryService,
        },
        ...TestMetrics,
      ],
    }).compile();

    controller = module.get<CompanyController>(CompanyController);
    mongoConnection = module.get<Connection>(getConnectionToken());
  });

  afterEach(async () => {
    await mongoConnection.dropCollection('companydbobjects');
    await mongoConnection.dropCollection('incomingrequestdbobjects');
    await mongoConnection.close(/*force=*/ true);
  });

  afterAll(async () => {
    await mongoServer.stop();
  });

  it('should create many companies', async () => {
    const company1 = { country: 'CH', taxId: '456', companyName: 'Fantastic Company' };
    const company2 = { country: 'PL', taxId: '789', companyName: 'Mediocre Company' };
    expect(await controller.insertOrUpdate([company1, company2])).toEqual([
      {
        company: {
          ...company1,
          id: expect.any(String),
          companyId: expect.any(String),
          created: expect.any(Date),
          lastUpdated: expect.any(Date),
        },
        message: expect.stringContaining('Inserted'),
      },
      {
        company: {
          ...company2,
          id: expect.any(String),
          companyId: expect.any(String),
          created: expect.any(Date),
          lastUpdated: expect.any(Date),
        },
        message: expect.stringContaining('Inserted'),
      },
    ]);
  });

  it('should search for a company', async () => {
    // We first need to create a few companies.
    await controller.insertOrUpdate([{ country: 'CH', taxId: '1', companyName: 'name1' }]);
    await controller.insertOrUpdate([{ country: 'CH', taxId: '2', companyName: 'some-name' }]);
    await controller.insertOrUpdate([{ country: 'CH', taxId: '3', companyName: 'some-name' }]);

    expect(await controller.search({ companyName: 'some-name' })).toEqual({
      companies: [
        {
          company: {
            id: expect.any(String),
            companyId: expect.any(String),
            country: 'CH',
            taxId: '2',
            companyName: 'some-name',
            created: expect.any(Date),
            lastUpdated: expect.any(Date),
          },
          confidence: expect.any(Number),
          foundBy: expect.any(String),
        },
        {
          company: {
            id: expect.any(String),
            companyId: expect.any(String),
            country: 'CH',
            taxId: '3',
            companyName: 'some-name',
            created: expect.any(Date),
            lastUpdated: expect.any(Date),
          },
          confidence: expect.any(Number),
          foundBy: expect.any(String),
        },
      ],
      message: expect.any(String),
    });
  });
});
