import { HttpModule } from '@nestjs/axios';
import { NotFoundException } from '@nestjs/common';
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
import { SENTRY_TOKEN } from '@ntegral/nestjs-sentry';

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
        {
          provide: SENTRY_TOKEN,
          useValue: { debug: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<CompanyController>(CompanyController);
    mongoConnection = module.get<Connection>(getConnectionToken());
  });

  afterEach(async () => {
    await mongoConnection.dropCollection('companydbobjects');
    await mongoConnection.close(/*force=*/ true);
  });

  afterAll(async () => {
    await mongoServer.stop();
  });

  it('should be defined', () => {
    expect(controller.v1()).toBeDefined();
  });

  it('should create a company', async () => {
    expect(await controller.add({ companyName: 'Fantastic Company' })).toEqual({
      company: {
        id: expect.any(String),
        companyName: 'Fantastic Company',
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
      },
    });
  });

  it('should create many companies', async () => {
    const companyDtos = [
      { companyName: 'Fantastic Company', country: 'CH', companyId: '456' },
      { companyName: 'Mediocre Company', country: 'PL', companyId: '789' },
    ];
    const companies = companyDtos.map((dto) => {
      return {
        ...dto,
        id: expect.any(String),
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
      };
    });
    expect(await controller.addMany(companyDtos)).toEqual({ companies });
  });

  it('should list all companies', async () => {
    // We first need to create a few companies.
    await controller.add({ companyName: '1' });
    await controller.add({ companyName: '2' });
    await controller.add({ companyName: '3' });

    expect(await controller.companies()).toEqual({
      companies: [
        { id: expect.any(String), companyName: '1', created: expect.any(Date), lastUpdated: expect.any(Date) },
        { id: expect.any(String), companyName: '2', created: expect.any(Date), lastUpdated: expect.any(Date) },
        { id: expect.any(String), companyName: '3', created: expect.any(Date), lastUpdated: expect.any(Date) },
      ],
    });
  });

  it('should get a company by id', async () => {
    // We first need to create a few companies.
    await controller.add({ companyName: '1' });
    const company2 = (await controller.add({ companyName: '2' })).company;
    await controller.add({ companyName: '3' });

    expect(await controller.getById(company2.id)).toEqual({
      company: { id: company2.id, companyName: '2', created: expect.any(Date), lastUpdated: expect.any(Date) },
    });
  });

  it('cannot get a non-existent company', async () => {
    expect(async () => {
      await controller.getById('non-existent-id');
    }).rejects.toThrowError(NotFoundException);
  });

  it('should find a company', async () => {
    // We first need to create a few companies.
    await controller.add({ companyName: '1' });
    await controller.add({ companyName: '2' });
    await controller.add({ companyName: '2' });

    expect(await controller.find({ companyName: '2' })).toEqual([
      {
        company: { id: expect.any(String), companyName: '2', created: expect.any(Date), lastUpdated: expect.any(Date) },
        confidence: expect.any(Number),
        foundBy: expect.any(String),
      },
      {
        company: { id: expect.any(String), companyName: '2', created: expect.any(Date), lastUpdated: expect.any(Date) },
        confidence: expect.any(Number),
        foundBy: expect.any(String),
      },
    ]);
  });
});
