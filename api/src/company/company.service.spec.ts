import { enableFetchMocks } from 'jest-fetch-mock';
enableFetchMocks();
import { Test, TestingModule } from '@nestjs/testing';
import { COMPANY_REPOSITORY } from './repository/repository-interface';
import { CompanyService } from './company.service';
import { TestMetrics } from './test-utils/company-service-metrics';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MongoRepositoryModule } from './repository/mongo/mongo.module';
import { MongoRepositoryService } from './repository/mongo/mongo.service';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as mongoose from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { Company } from './company.model';
import { CompanyKeyDto } from './dto/company-key.dto';
import fetch from 'node-fetch';
import { CompanyDbObject, CompanyDocument } from './repository/mongo/company.schema';

describe('CompanyService', () => {
  const messageCompaniesFoundInRepository = 'Companies were found in repository';
  const messageAtTimeWasSet = 'No companies found; request not sent to the ScraperService because "atTime" was set';

  let service: CompanyService;
  let mongoServer: MongoMemoryServer;
  let companyModel: mongoose.Model<CompanyDocument>;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongoServer.getUri();

    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule, ConfigModule.forRoot(), MongoRepositoryModule],
      providers: [
        CompanyService,
        {
          provide: COMPANY_REPOSITORY,
          useClass: MongoRepositoryService,
        },
        ...TestMetrics,
      ],
    }).compile();
    service = module.get<CompanyService>(CompanyService);
    companyModel = module.get(getModelToken(CompanyDbObject.name));
  });

  beforeEach(async () => {
    await companyModel.deleteMany({}); // Each test starts with an empty db.

    fetch.resetMocks();
    fetch.mockResponse(JSON.stringify({})); // By default, don't return anything.
  });

  afterAll(async () => {
    await mongoServer.stop();
    await mongoose.disconnect();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should list all companies', async () => {
    // We first need to create a few companies.
    await service.insertOrUpdate({ country: 'CH', companyId: '1', companyName: '1' });
    await service.insertOrUpdate({ country: 'CH', companyId: '2', companyName: '2' });
    await service.insertOrUpdate({ country: 'CH', companyId: '3', companyName: '3' });

    expect(await service.listAllForTesting()).toEqual([
      {
        id: expect.any(String),
        country: 'CH',
        companyId: '1',
        companyName: '1',
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
      },
      {
        id: expect.any(String),
        country: 'CH',
        companyId: '2',
        companyName: '2',
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
      },
      {
        id: expect.any(String),
        country: 'CH',
        companyId: '3',
        companyName: '3',
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
      },
    ]);
  });

  describe('the get method', () => {
    it('should return the most recent record when `atTime` is not set', async () => {
      await service.insertOrUpdate({ country: 'CH', companyId: '1', companyName: 'name1' });
      await service.insertOrUpdate({ country: 'CH', companyId: '1', companyName: 'name2' });
      const [mostRecent] = await service.insertOrUpdate({ country: 'CH', companyId: '1', companyName: 'name3' });

      expect(await service.get({ country: 'CH', companyId: '1' })).toEqual([
        [
          {
            confidence: expect.any(Number),
            foundBy: 'Repository by companyId and country',
            company: mostRecent,
          },
        ],
        messageCompaniesFoundInRepository,
      ]);
    });

    it('should return historical records that correspond to the requested `atTime`', async () => {
      const [firstRecord] = await service.insertOrUpdate({ country: 'CH', companyId: '1', companyName: 'name1' });
      const [secondRecord] = await service.insertOrUpdate({ country: 'CH', companyId: '1', companyName: 'name2' });
      const [mostRecent] = await service.insertOrUpdate({ country: 'CH', companyId: '1', companyName: 'name3' });

      // Note: these unit tests use the real clock and may show up as flakey in the
      // unlikely case that the records above were created at the same millisecond.
      const atTimeExpectations = new Map<Date, Company>([
        [firstRecord.created, firstRecord],
        [new Date(secondRecord.created.getTime() - 1), firstRecord],
        [secondRecord.created, secondRecord],
        [new Date(mostRecent.created.getTime() - 1), secondRecord],
        [mostRecent.created, mostRecent],
        [new Date(mostRecent.created.getTime() + 5000), mostRecent],
      ]);
      for (const [atTime, company] of atTimeExpectations) {
        expect(await service.get({ country: 'CH', companyId: '1', atTime: atTime })).toEqual([
          [
            {
              confidence: expect.any(Number),
              foundBy: 'Repository by companyId and country',
              company: company,
            },
          ],
          messageCompaniesFoundInRepository,
        ]);
      }
    });

    it('should not return deleted records', async () => {
      const company = { country: 'CH', companyId: '1' };
      await service.markDeleted(company);

      const wantInDb = {
        id: expect.any(String),
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
        isDeleted: true,
        country: company.country,
        companyId: company.companyId,
      };
      expect(await service.listAllForTesting()).toEqual([wantInDb]);
      expect(await service.get({ country: company.country, companyId: company.companyId })).toEqual([[], undefined]);
    });

    it('should not return historical records marked as deleted', async () => {
      const company = { country: 'CH', companyId: '1', companyName: 'name1' };

      await service.insertOrUpdate(company);
      await service.markDeleted(company);
      await service.insertOrUpdate(company);

      const wantInserted = {
        id: expect.any(String),
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
        country: company.country,
        companyId: company.companyId,
        companyName: company.companyName,
      };
      const wantDeleted = {
        id: expect.any(String),
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
        isDeleted: true,
        country: company.country,
        companyId: company.companyId,
      };
      const dbContents = await service.listAllForTesting();
      expect(dbContents).toEqual([wantInserted, wantDeleted, wantInserted]);

      expect(
        await service.get({
          country: company.country,
          companyId: company.companyId,
          atTime: new Date(dbContents[0].created.getTime() - 1),
        }),
      ).toEqual([[], messageAtTimeWasSet]);
      expect(
        await service.get({
          country: company.country,
          companyId: company.companyId,
          atTime: dbContents[0].created,
        }),
      ).toEqual([
        [
          {
            confidence: expect.any(Number),
            foundBy: 'Repository by companyId and country',
            company: wantInserted,
          },
        ],
        messageCompaniesFoundInRepository,
      ]);
      expect(
        await service.get({
          country: company.country,
          companyId: company.companyId,
          atTime: dbContents[1].created,
        }),
      ).toEqual([[], messageAtTimeWasSet]);
      expect(
        await service.get({
          country: company.country,
          companyId: company.companyId,
          atTime: dbContents[2].created,
        }),
      ).toEqual([
        [
          {
            confidence: expect.any(Number),
            foundBy: 'Repository by companyId and country',
            company: wantInserted,
          },
        ],
        messageCompaniesFoundInRepository,
      ]);
    });

    it('should not contact scraper service for historical queries', async () => {
      expect(await service.get({ country: 'DK', companyId: '42', atTime: new Date('2020') })).toEqual([
        [],
        messageAtTimeWasSet,
      ]);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('the insertOrUpdate method', () => {
    it('should insert a new record for a non-existent company', async () => {
      const company = { country: 'CH', companyId: '1', companyName: 'name1', dataSource: 'Unit-Test' };

      const wantInDb = {
        id: expect.any(String),
        country: company.country,
        companyId: company.companyId,
        companyName: company.companyName,
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
        dataSource: 'Unit-Test',
      };
      expect(await service.insertOrUpdate(company)).toEqual([wantInDb, expect.stringContaining('Inserted')]);
      expect(await service.listAllForTesting()).toEqual([wantInDb]);
    });

    it('should not insert a new record if metadata did not change', async () => {
      const company = { country: 'CH', companyId: '1', companyName: 'name1' };

      const want = {
        id: expect.any(String),
        country: company.country,
        companyId: company.companyId,
        companyName: company.companyName,
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
      };
      let result = await service.insertOrUpdate(company);
      expect(result).toEqual([want, expect.stringContaining('Inserted')]);
      expect(result[0].lastUpdated.getTime()).toEqual(result[0].created.getTime());
      let dbContents = await service.listAllForTesting();
      expect(dbContents).toEqual([want]);
      expect(dbContents[0].lastUpdated.getTime()).toEqual(dbContents[0].created.getTime());

      // The return value and the db contents should reflect a change in `lastUpdated` time.
      result = await service.insertOrUpdate(company);
      expect(result).toEqual([want, expect.stringContaining('Marked as up-to-date')]);
      expect(result[0].lastUpdated.getTime()).toBeGreaterThan(result[0].created.getTime());
      dbContents = await service.listAllForTesting();
      expect(dbContents).toEqual([want]);
      expect(dbContents[0].lastUpdated.getTime()).toBeGreaterThan(dbContents[0].created.getTime());
    });

    it('should insert a new record for updates to the same company', async () => {
      const metadata1 = { country: 'CH', companyId: '1', companyName: 'Old Name LLC' };
      const metadata2 = { country: 'CH', companyId: '1', companyName: 'New Name Inc' };

      const want1 = {
        id: expect.any(String),
        country: metadata1.country,
        companyId: metadata1.companyId,
        companyName: metadata1.companyName,
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
      };
      const want2 = {
        id: expect.any(String),
        country: metadata2.country,
        companyId: metadata2.companyId,
        companyName: metadata2.companyName,
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
      };
      expect(await service.insertOrUpdate(metadata1)).toEqual([want1, expect.stringContaining('Inserted')]);
      expect(await service.listAllForTesting()).toEqual([want1]);
      expect(await service.insertOrUpdate(metadata2)).toEqual([want2, expect.stringContaining('Updated')]);
      expect(await service.listAllForTesting()).toEqual([want1, want2]);
      expect(await service.insertOrUpdate(metadata2)).toEqual([want2, expect.stringContaining('Marked as up-to-date')]);
      expect(await service.listAllForTesting()).toEqual([want1, want2]);
    });
  });

  describe('the markDeleted method', () => {
    it('should insert a delete record for a non-existent company', async () => {
      const nonExistent: CompanyKeyDto = { country: 'YZ', companyId: '123' };

      const wantDelete = {
        id: expect.any(String),
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
        country: nonExistent.country,
        companyId: nonExistent.companyId,
        isDeleted: true,
      };
      expect(await service.markDeleted(nonExistent)).toEqual([
        wantDelete,
        expect.stringContaining('Marked as deleted'),
      ]);
      expect(await service.listAllForTesting()).toEqual([wantDelete]);
    });

    it('should insert a delete record for an active company', async () => {
      const company = { country: 'CH', companyId: '1', companyName: 'name1' };
      await service.insertOrUpdate(company);

      const wantInitial = {
        id: expect.any(String),
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
        country: company.country,
        companyId: company.companyId,
        companyName: company.companyName,
      };
      const wantDelete = {
        id: expect.any(String),
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
        country: company.country,
        companyId: company.companyId,
        isDeleted: true,
      };
      expect(await service.markDeleted(company)).toEqual([wantDelete, expect.stringContaining('Marked as deleted')]);
      expect(await service.listAllForTesting()).toEqual([wantInitial, wantDelete]);
    });

    it('should update the latest delete record for an already-deleted company', async () => {
      const company = { country: 'CH', companyId: '1', companyName: 'name1' };
      await service.insertOrUpdate(company);
      await service.markDeleted(company);

      const wantInitial = {
        id: expect.any(String),
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
        country: company.country,
        companyId: company.companyId,
        companyName: company.companyName,
      };
      const wantDelete = {
        id: expect.any(String),
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
        country: company.country,
        companyId: company.companyId,
        isDeleted: true,
      };

      // The return value and the db contents should reflect a change in `lastUpdated` time.
      const result = await service.markDeleted(company);
      expect(result).toEqual([wantDelete, expect.stringContaining('Marked as up-to-date')]);
      expect(result[0].lastUpdated.getTime()).toBeGreaterThan(result[0].created.getTime());
      const dbContents = await service.listAllForTesting();
      expect(dbContents).toEqual([wantInitial, wantDelete]);
      expect(dbContents[1].lastUpdated.getTime()).toBeGreaterThan(dbContents[1].created.getTime());
    });
  });

  it('should find a company by id', async () => {
    const [company] = await service.insertOrUpdate({ country: 'CH', companyId: '1', companyName: '1' });

    const found = await service.search({ id: company.id });
    expect(found).toEqual([
      [
        {
          company: {
            id: company.id,
            country: company.country,
            companyId: company.companyId,
            companyName: company.companyName,
            created: expect.any(Date),
            lastUpdated: expect.any(Date),
          },
          confidence: expect.any(Number),
          foundBy: expect.any(String),
        },
      ],
      messageCompaniesFoundInRepository,
    ]);
  });

  it('should find a company by company id and country', async () => {
    await service.insertOrUpdate({ companyName: '1', companyId: '123', country: 'CH' });

    const found = await service.search({ companyId: '123', country: 'CH' });
    expect(found).toEqual([
      [
        {
          company: {
            id: expect.any(String),
            companyName: '1',
            companyId: '123',
            country: 'CH',
            created: expect.any(Date),
            lastUpdated: expect.any(Date),
          },
          confidence: expect.any(Number),
          foundBy: expect.any(String),
        },
      ],
      messageCompaniesFoundInRepository,
    ]);
  });

  it('should find all companies that match a name', async () => {
    await service.insertOrUpdate({ country: 'CH', companyId: '1', companyName: 'some-name' });
    await service.insertOrUpdate({ country: 'DK', companyId: '2', companyName: 'some-name' });

    const [found, _] = await service.search({ companyName: 'some-name' });
    expect(found).toEqual([
      {
        company: {
          id: expect.any(String),
          country: 'CH',
          companyId: '1',
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
          country: 'DK',
          companyId: '2',
          companyName: 'some-name',
          created: expect.any(Date),
          lastUpdated: expect.any(Date),
        },
        confidence: expect.any(Number),
        foundBy: expect.any(String),
      },
    ]);
  });

  it('should find a company if one individual field matches', async () => {
    await service.insertOrUpdate({ country: 'CH', companyId: '1', companyName: '1' });

    const [found, _] = await service.search({ id: 'non-existent-id', companyName: '1' });
    expect(found).toEqual([
      {
        company: {
          id: expect.any(String),
          country: 'CH',
          companyId: '1',
          companyName: '1',
          created: expect.any(Date),
          lastUpdated: expect.any(Date),
        },
        confidence: expect.any(Number),
        foundBy: expect.any(String),
      },
    ]);
  });

  it('should not contact the scaper service if there are matches in the repo', async () => {
    await service.insertOrUpdate({ country: 'CH', companyId: '1', companyName: '1' });

    const [found, _] = await service.search({ id: 'non-existent-id', companyName: '1' });
    expect(found).toEqual([
      {
        company: {
          id: expect.any(String),
          country: 'CH',
          companyId: '1',
          companyName: '1',
          created: expect.any(Date),
          lastUpdated: expect.any(Date),
        },
        confidence: expect.any(Number),
        foundBy: expect.any(String),
      },
    ]);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('should find companies that match individual fields, ordered by confidence', async () => {
    const [company1] = await service.insertOrUpdate({ country: 'CH', companyId: '1', companyName: 'to-find-by-id' });
    await service.insertOrUpdate({ country: 'DK', companyId: '1', companyName: 'to-find-by-name' });
    await service.insertOrUpdate({ country: 'CH', companyId: '123', companyName: 'to-find-by-company-id-and-country' });

    const [found, _] = await service.search({
      id: company1.id,
      companyId: '123',
      country: 'CH',
      companyName: 'to-find-by-name',
    });
    expect(found).toEqual([
      // The ranking of confidences are: (1) match by id, (2) match by companyId and country, and (3) match by name.
      {
        company: {
          id: company1.id,
          country: company1.country,
          companyId: company1.companyId,
          companyName: 'to-find-by-id',
          created: expect.any(Date),
          lastUpdated: expect.any(Date),
        },
        confidence: expect.any(Number),
        foundBy: expect.any(String),
      },
      {
        company: {
          id: expect.any(String),
          country: 'CH',
          companyId: '123',
          companyName: 'to-find-by-company-id-and-country',
          created: expect.any(Date),
          lastUpdated: expect.any(Date),
        },
        confidence: expect.any(Number),
        foundBy: expect.any(String),
      },
      {
        company: {
          id: expect.any(String),
          country: 'DK',
          companyId: '1',
          companyName: 'to-find-by-name',
          created: expect.any(Date),
          lastUpdated: expect.any(Date),
        },
        confidence: expect.any(Number),
        foundBy: expect.any(String),
      },
    ]);
  });

  it('should find and deduplicate companies that match multiple individual fields', async () => {
    const [company] = await service.insertOrUpdate({ country: 'CH', companyId: '123', companyName: '1' });

    const [found, _] = await service.search({ id: company.id, companyName: '1', companyId: '123', country: 'CH' });
    expect(found).toEqual([
      {
        company: {
          id: expect.any(String),
          companyName: '1',
          companyId: '123',
          country: 'CH',
          created: expect.any(Date),
          lastUpdated: expect.any(Date),
        },
        confidence: expect.any(Number),
        foundBy: expect.any(String),
      },
    ]);
  });

  describe('when the company is not found in the first repo', () => {
    describe('and the company is found by the scraper service', () => {
      beforeEach(() => {
        fetch.resetMocks();

        fetch.mockResponseOnce(
          JSON.stringify({
            companies: [
              {
                companies: [
                  {
                    company: { companyName: 'company found', country: 'CH', companyId: '456', dataSource: 'Unit-Test' },
                    confidence: 1,
                  },
                ],
                scraperName: 'CH',
              },
            ],
            message: 'Message from the ScraperService',
          }),
        );
      });
      it('should create and find a company', async () => {
        let found = await service.search({ companyName: 'non-existent-name' });
        expect(found).toEqual([
          [
            {
              company: {
                id: expect.any(String),
                companyName: 'company found',
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
                country: 'CH',
                companyId: '456',
                dataSource: 'Unit-Test',
              },
              confidence: 1,
              foundBy: 'Scraper CH',
            },
          ],
          'Message from the ScraperService',
        ]);

        found = await service.search({
          country: found[0][0].company.country,
          companyId: found[0][0].company.companyId,
        });
        expect(found).toEqual([
          [
            {
              company: {
                id: expect.any(String),
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
                country: 'CH',
                companyId: '456',
                companyName: 'company found',
                dataSource: 'Unit-Test',
              },
              confidence: expect.any(Number),
              foundBy: expect.any(String),
            },
          ],
          messageCompaniesFoundInRepository,
        ]);
      });
    });

    describe('and multiple companies are found by the scraper service', () => {
      beforeEach(() => {
        fetch.resetMocks();
        fetch.mockResponseOnce(
          JSON.stringify({
            companies: [
              {
                companies: [
                  { company: { companyName: 'company found' } },
                  { company: { companyName: 'another company found', country: 'CH', companyId: '456' } },
                ],
              },
            ],
            message: 'Message from ScraperService',
          }),
        );
      });
      it('should find and create all companies', async () => {
        const found = await service.search({ companyName: 'irrelevant' });
        expect(found).toEqual([
          [
            {
              company: {
                id: expect.any(String),
                companyName: 'company found',
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
              },
            },
            {
              company: {
                id: expect.any(String),
                companyName: 'another company found',
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
                country: 'CH',
                companyId: '456',
              },
            },
          ],
          'Message from ScraperService',
        ]);
        let found2 = await service.get({
          country: found[0][0].company.country,
          companyId: found[0][0].company.companyId,
        });
        expect(found2).toEqual([
          [
            {
              company: {
                id: expect.any(String),
                companyName: 'company found',
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
              },
              confidence: expect.any(Number),
              foundBy: expect.any(String),
            },
          ],
          messageCompaniesFoundInRepository,
        ]);
        found2 = await service.get({
          country: found[0][1].company.country,
          companyId: found[0][1].company.companyId,
        });
        expect(found2).toEqual([
          [
            {
              company: {
                id: expect.any(String),
                companyName: 'another company found',
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
                country: 'CH',
                companyId: '456',
              },
              confidence: expect.any(Number),
              foundBy: expect.any(String),
            },
          ],
          messageCompaniesFoundInRepository,
        ]);
      });

      describe('and results contain a confidence value', () => {
        beforeEach(() => {
          fetch.resetMocks();
          fetch.mockResponseOnce(
            JSON.stringify({
              companies: [
                {
                  companies: [
                    { company: { companyName: '1' }, confidence: 0.5 },
                    { company: { companyName: '2' }, confidence: 0.7 },
                    { company: { companyName: '3' }, confidence: 0.9 },
                    { company: { companyName: '4' }, confidence: 0.6 },
                    { company: { companyName: '5' } },
                  ],
                },
              ],
            }),
          );
        });
        it('results should be sorted by confidence in descending order', async () => {
          const [found, _] = await service.search({ companyName: 'irrelevant' });
          expect(found).toEqual([
            {
              company: {
                companyName: '3',
                id: expect.any(String),
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
              },
              confidence: 0.9,
            },
            {
              company: {
                companyName: '2',
                id: expect.any(String),
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
              },
              confidence: 0.7,
            },
            {
              company: {
                companyName: '4',
                id: expect.any(String),
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
              },
              confidence: 0.6,
            },
            {
              company: {
                companyName: '1',
                id: expect.any(String),
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
              },
              confidence: 0.5,
            },
            // Items without confidences come last.
            {
              company: {
                companyName: '5',
                id: expect.any(String),
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
              },
            },
          ]);
        });
      });
    });

    describe('and the company is not found by the scraper service', () => {
      beforeEach(() => {
        fetch.resetMocks();
        fetch.mockResponseOnce(JSON.stringify({ message: 'Message from ScraperService' }));
      });
      it('should not find a company if we provide the company name', async () => {
        expect(await service.search({ companyName: 'non-existent-name' })).toEqual([[], 'Message from ScraperService']);
      });

      it('should not find a company if we provide company id and country', async () => {
        expect(await service.search({ companyId: '123', country: 'CH' })).toEqual([[], 'Message from ScraperService']);
      });

      it('should not find a company if we provide the id', async () => {
        expect(await service.search({ id: 'non-existent-id' })).toEqual([[], 'Message from ScraperService']);
      });
    });

    describe('and the scraper service cannot be contacted', () => {
      beforeEach(() => {
        fetch.resetMocks();
        // node-fetch's fetch method returns an error if the connection fails.
        fetch.mockReject(new Error('Ouch!'));
      });
      it('should propagate the failure', async () => {
        await expect(service.search({ country: 'irrelevant', companyId: 'irrelevant' })).rejects.toThrowError(
          'Cannot contact ScraperService, is the service available? Error: Ouch!',
        );
      });
    });

    describe('and the scraper service returns a failure', () => {
      beforeEach(() => {
        fetch.resetMocks();
        // If the connection succeeds but the operation itself returns an error,
        // the status of the response will be a failure (see
        // 'and the scraper service returns a failure').
        fetch.mockResponseOnce(JSON.stringify({ message: 'Something bad happened' }), {
          status: 501, // An arbitrary failure status.
        });
      });
      it('should propagate the failure', async () => {
        await expect(service.search({ country: 'irrelevant', companyId: 'irrelevant' })).rejects.toThrowError(
          'Request to ScraperService failed: Something bad happened',
        );
      });
    });

    describe('and the scraper service returns a response with a message and no companies', () => {
      beforeEach(() => {
        fetch.resetMocks();
        fetch.mockResponseOnce(JSON.stringify({ companies: [], message: 'Could not find an answer' }));
      });
      it('should return the message', async () => {
        expect(await service.search({ country: 'irrelevant', companyId: 'irrelevant' })).toEqual([
          [],
          'Could not find an answer',
        ]);
      });
    });

    describe('and the scraper service returns a response with a message and companies', () => {
      beforeEach(() => {
        fetch.resetMocks();
        fetch.mockResponseOnce(
          JSON.stringify({
            companies: [{ companies: [{ company: { companyName: 'company found' } }] }],
            message: 'Some message',
          }),
        );
      });
      it('should return the message  and the companies', async () => {
        expect(await service.search({ country: 'irrelevant', companyId: 'irrelevant' })).toEqual([
          [
            {
              company: {
                id: expect.any(String),
                companyName: 'company found',
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
              },
            },
          ],
          'Some message',
        ]);
      });
    });

    describe('and the scraper service returns a malformed response', () => {
      beforeEach(() => {
        fetch.resetMocks();
        fetch.mockResponseOnce(
          JSON.stringify({
            companies: {}, // Malformed because "companies" should be a list.
          }),
        );
      });
      it('should propagate the failure', async () => {
        await expect(service.search({ country: 'irrelevant', companyId: 'irrelevant' })).rejects.toThrowError(
          new RegExp('Error parsing response from ScraperService.*'),
        );
        // We don't want to assert on the full string:
        // `Error parsing response from ScraperService: TypeError: response.companies is not iterable`
        // in case the way the type error is reported changes.
      });
    });

    it('should throw error if we did not ask for any field', async () => {
      await service.insertOrUpdate({ country: 'CH', companyId: '1', companyName: '1' });
      await service.insertOrUpdate({ country: 'DK', companyId: '45', companyName: '2' });
      await service.insertOrUpdate({ country: 'US', companyId: '60', companyName: '3' });

      await expect(service.search({})).rejects.toThrowError('Search request cannot be empty');
    });
  });
});
