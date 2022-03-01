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
import { SearchDto } from './dto/search.dto';
import { IncomingRequestDbObject, IncomingRequestDocument } from './repository/mongo/incoming-request.schema';
import { RequestType } from './repository/mongo/incoming-request.model';

describe('CompanyService', () => {
  const messageCompaniesFoundInRepository = 'Companies were found in repository';
  const messageAtTimeWasSet = 'No companies found; request not sent to the ScraperService because "atTime" was set';
  const foundByRepoByCompanyId = 'Repository by companyId and country';
  const foundByRepoByName = 'Repository by name';
  const requestTypeInsertOrUpdate = RequestType.InsertOrUpdate;
  const requestTypeMarkDeleted = RequestType.MarkDeleted;

  let service: CompanyService;
  let mongoServer: MongoMemoryServer;
  let companyModel: mongoose.Model<CompanyDocument>;
  let incomingRequestModel: mongoose.Model<IncomingRequestDocument>;

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
    incomingRequestModel = module.get(getModelToken(IncomingRequestDbObject.name));
  });

  beforeEach(async () => {
    // Each test starts with an empty db.
    await companyModel.deleteMany({});
    await incomingRequestModel.deleteMany({});

    fetch.resetMocks();
    fetch.mockResponse(JSON.stringify({})); // By default, don't return anything.
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop(/* runCleanup= */ true);
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

  describe('the insertOrUpdate method', () => {
    it('should insert a new record for a non-existent company', async () => {
      const company = { country: 'CH', companyId: '1', companyName: 'name1', dataSource: 'Unit-Test', isic: 'isic' };

      const wantInDb = {
        id: expect.any(String),
        country: company.country,
        companyId: company.companyId,
        companyName: company.companyName,
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
        dataSource: 'Unit-Test',
        isic: 'isic',
      };
      expect(await service.insertOrUpdate(company)).toEqual([wantInDb, expect.stringContaining('Inserted')]);
      expect(await service.listAllForTesting()).toEqual([wantInDb]);

      // Check that the incoming request was persisted.
      const wantIncomingRequestInDb = {
        country: company.country,
        companyId: company.companyId,
        companyName: company.companyName,
        created: expect.any(Date),
        dataSource: 'Unit-Test',
        isic: 'isic',
        requestType: requestTypeInsertOrUpdate,
      };
      expect(await service.listAllIncomingRequestsForTesting()).toEqual([wantIncomingRequestInDb]);
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

      // Check that all incoming requests were persisted.
      const wantIncomingRequestInDb = {
        country: company.country,
        companyId: company.companyId,
        companyName: company.companyName,
        created: expect.any(Date),
        requestType: requestTypeInsertOrUpdate,
      };
      expect(await service.listAllIncomingRequestsForTesting()).toEqual([
        wantIncomingRequestInDb,
        wantIncomingRequestInDb,
      ]);
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

      // Check that all incoming requests were persisted.
      const wantIncomingRequest1 = {
        country: metadata1.country,
        companyId: metadata1.companyId,
        companyName: metadata1.companyName,
        created: expect.any(Date),
        requestType: requestTypeInsertOrUpdate,
      };
      const wantIncomingRequest2 = {
        country: metadata2.country,
        companyId: metadata2.companyId,
        companyName: metadata2.companyName,
        created: expect.any(Date),
        requestType: requestTypeInsertOrUpdate,
      };
      expect(await service.listAllIncomingRequestsForTesting()).toEqual([
        wantIncomingRequest1,
        wantIncomingRequest2,
        wantIncomingRequest2,
      ]);
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

      // Check that the incoming request was persisted.
      const wantIncomingRequest = {
        companyId: nonExistent.companyId,
        created: expect.any(Date),
        requestType: requestTypeMarkDeleted,
      };
      expect(await service.listAllIncomingRequestsForTesting()).toEqual([wantIncomingRequest]);
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

      // Check that all incoming requests were persisted.
      const wantIncomingRequest1 = {
        country: company.country,
        companyId: company.companyId,
        companyName: company.companyName,
        created: expect.any(Date),
        requestType: requestTypeInsertOrUpdate,
      };

      const wantIncomingRequest2 = {
        companyId: company.companyId,
        created: expect.any(Date),
        requestType: requestTypeMarkDeleted,
      };
      expect(await service.listAllIncomingRequestsForTesting()).toEqual([wantIncomingRequest1, wantIncomingRequest2]);
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

      // Check that all incoming requests were persisted.
      const wantIncomingRequest1 = {
        country: company.country,
        companyId: company.companyId,
        companyName: company.companyName,
        created: expect.any(Date),
        requestType: requestTypeInsertOrUpdate,
      };

      const wantIncomingRequest2 = {
        companyId: company.companyId,
        created: expect.any(Date),
        requestType: requestTypeMarkDeleted,
      };
      expect(await service.listAllIncomingRequestsForTesting()).toEqual([
        wantIncomingRequest1,
        wantIncomingRequest2,
        wantIncomingRequest2,
      ]);
    });
  });

  describe('the search method', () => {
    describe('when there is a single record of a company', () => {
      beforeEach(async () => {
        await service.insertOrUpdate({ companyName: 'name1', companyId: '123', country: 'CH' });
      });

      const expectations: [string, SearchDto][] = [
        ['company id and country', { country: 'CH', companyId: '123' }],
        ['company name', { companyName: 'name1' }],
      ];
      for (const [title, searchDto] of expectations) {
        it(`and we search by ${title}, should find the record`, async () => {
          const found = await service.search(searchDto);
          expect(found).toEqual([
            [
              {
                company: {
                  id: expect.any(String),
                  companyName: 'name1',
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
      }
    });

    describe('when there are multiple records of a company', () => {
      let firstRecord: Company;
      let secondRecord: Company;
      let mostRecent: Company;

      beforeEach(async () => {
        [firstRecord] = await service.insertOrUpdate({ companyName: '1', companyId: '123', country: 'CH' });
        [secondRecord] = await service.insertOrUpdate({ companyName: '2', companyId: '123', country: 'CH' });
        [mostRecent] = await service.insertOrUpdate({ companyName: '3', companyId: '123', country: 'CH' });
      });

      const expectations: [string, SearchDto, string][] = [
        ['company id and country', { country: 'CH', companyId: '123' }, foundByRepoByCompanyId],
        ['first company name', { companyName: '1' }, foundByRepoByName],
        ['second company name', { companyName: '2' }, foundByRepoByName],
        ['most recent company name', { companyName: '3' }, foundByRepoByName],
      ];
      for (const [title, searchDto, wantFoundBy] of expectations) {
        it(`and we search by ${title} and no 'atTime', should return the most recent record`, async () => {
          expect(await service.search(searchDto)).toEqual([
            [
              {
                confidence: expect.any(Number),
                foundBy: wantFoundBy,
                company: mostRecent,
              },
            ],
            messageCompaniesFoundInRepository,
          ]);
        });

        it(`and we search by ${title}, should return historical records that correspond to the requested 'atTime'`, async () => {
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
            expect(
              await service.search({
                country: searchDto.country,
                companyId: searchDto.companyId,
                companyName: searchDto.companyName,
                atTime: atTime,
              }),
            ).toEqual([
              [
                {
                  confidence: expect.any(Number),
                  foundBy: wantFoundBy,
                  company: company,
                },
              ],
              messageCompaniesFoundInRepository,
            ]);
          }
        });
      }
    });

    describe('when the only record is deleted', () => {
      beforeEach(async () => {
        await service.markDeleted({ country: 'CH', companyId: '1' });
        const wantInDb = {
          id: expect.any(String),
          created: expect.any(Date),
          lastUpdated: expect.any(Date),
          isDeleted: true,
          country: 'CH',
          companyId: '1',
        };
        expect(await service.listAllForTesting()).toEqual([wantInDb]);
      });

      const expectations: [string, SearchDto][] = [
        ['company id and country', { country: 'CH', companyId: '1' }],
        ['company name', { companyName: '1' }],
      ];

      for (const [title, searchDto] of expectations) {
        it(`and we search by ${title}, should not return deleted records`, async () => {
          expect(await service.search(searchDto)).toEqual([[], undefined]);
        });
      }
    });

    describe('when there are historical deleted records', () => {
      let dbContents: Company[];
      let wantInserted;

      beforeEach(async () => {
        const company = { country: 'CH', companyId: '1', companyName: 'name1' };
        await service.insertOrUpdate(company);
        await service.markDeleted(company);
        await service.insertOrUpdate(company);

        wantInserted = {
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
        dbContents = await service.listAllForTesting();
        expect(dbContents).toEqual([wantInserted, wantDeleted, wantInserted]);
      });

      const expectations: [string, SearchDto, string][] = [
        ['company id and country', { country: 'CH', companyId: '1' }, foundByRepoByCompanyId],
        ['company name', { companyName: 'name1' }, foundByRepoByName],
      ];

      for (const [title, searchDto, wantFoundBy] of expectations) {
        it(`and we search by ${title}, should not return historical records marked as deleted`, async () => {
          expect(
            await service.search({
              ...searchDto,
              atTime: new Date(dbContents[0].created.getTime() - 1),
            }),
          ).toEqual([[], messageAtTimeWasSet]);
          expect(
            await service.search({
              ...searchDto,
              atTime: dbContents[0].created,
            }),
          ).toEqual([
            [
              {
                confidence: expect.any(Number),
                foundBy: wantFoundBy,
                company: wantInserted,
              },
            ],
            messageCompaniesFoundInRepository,
          ]);
          expect(
            await service.search({
              ...searchDto,
              atTime: dbContents[1].created,
            }),
          ).toEqual([[], messageAtTimeWasSet]);
          expect(
            await service.search({
              ...searchDto,
              atTime: dbContents[2].created,
            }),
          ).toEqual([
            [
              {
                confidence: expect.any(Number),
                foundBy: wantFoundBy,
                company: wantInserted,
              },
            ],
            messageCompaniesFoundInRepository,
          ]);
        });
      }
    });

    it('should not contact scraper service for historical queries', async () => {
      expect(await service.search({ country: 'DK', companyId: '42', atTime: new Date('2020') })).toEqual([
        [],
        messageAtTimeWasSet,
      ]);
      expect(fetch).not.toHaveBeenCalled();
    });

    describe('when there are multiple companies with multiple records each', () => {
      beforeEach(async () => {
        // These records correspond to the same company because country and companyId are the same.
        // In order to create a new record we need the company metadata to change.
        // We cannot change companyName because we want to search by that, so we use a different arbitrary field (isic).
        await service.insertOrUpdate({ country: 'CH', companyId: '1', companyName: 'name', isic: 'original' });
        await service.insertOrUpdate({ country: 'CH', companyId: '1', companyName: 'name', isic: 'updated' });
        await service.insertOrUpdate({ country: 'CH', companyId: '2', companyName: 'name', isic: 'original' });
        await service.insertOrUpdate({ country: 'CH', companyId: '2', companyName: 'name', isic: 'updated' });
      });

      const expectations: [string, SearchDto, string][] = [
        ['company name', { companyName: 'name' }, foundByRepoByName],
      ];

      for (const [title, searchDto, wantFoundBy] of expectations) {
        it(`and we search by ${title} and no 'atTime', should return the last record for each company`, async () => {
          const [found] = await service.search(searchDto);
          expect(found).toEqual([
            {
              company: {
                id: expect.any(String),
                country: 'CH',
                companyId: '1',
                companyName: 'name',
                isic: 'updated',
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
              },
              confidence: expect.any(Number),
              foundBy: wantFoundBy,
            },
            {
              company: {
                id: expect.any(String),
                country: 'CH',
                companyId: '2',
                companyName: 'name',
                isic: 'updated',
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
              },
              confidence: expect.any(Number),
              foundBy: wantFoundBy,
            },
          ]);
        });
      }
    });

    it('should find a company even if only individual search fields match', async () => {
      await service.insertOrUpdate({ country: 'CH', companyId: '1', companyName: '1' });

      const [found] = await service.search({
        country: 'CH',
        companyId: 'something-different-from-1',
        companyName: '1',
      });
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

    it('should not contact the scraper service if there are matches in the repo', async () => {
      await service.insertOrUpdate({ country: 'CH', companyId: '1', companyName: '1' });

      const [found] = await service.search({ country: 'CH', companyId: '1' });
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
      await service.insertOrUpdate({ country: 'CH', companyId: '2', companyName: 'name-to-search-for' });
      await service.insertOrUpdate({ country: 'CH', companyId: 'id-to-search-for', companyName: '1' });

      const [found] = await service.search({
        companyId: 'id-to-search-for',
        country: 'CH',
        companyName: 'name-to-search-for',
      });
      expect(found).toEqual([
        // The ranking of confidences are: (1) match by companyId and country, and (2) match by name.
        {
          company: {
            id: expect.any(String),
            country: 'CH',
            companyId: 'id-to-search-for',
            companyName: '1',
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
            companyId: '2',
            companyName: 'name-to-search-for',
            created: expect.any(Date),
            lastUpdated: expect.any(Date),
          },
          confidence: expect.any(Number),
          foundBy: expect.any(String),
        },
      ]);
    });

    it('should find and deduplicate companies that match multiple search methods', async () => {
      await service.insertOrUpdate({ country: 'CH', companyId: '123', companyName: '1' });

      // This request matches the data by name AND companyId. Make sure only one item is returned, and
      // it has the highest confidence of both methods.
      const [found] = await service.search({ companyName: '1', companyId: '123', country: 'CH' });
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
          foundBy: foundByRepoByCompanyId,
        },
      ]);
    });
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
                  { company: { companyName: 'company found', country: 'CH', companyId: '123' } },
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
                country: 'CH',
                companyId: '123',
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
        let found2 = await service.search({
          country: found[0][0].company.country,
          companyId: found[0][0].company.companyId,
        });
        expect(found2).toEqual([
          [
            {
              company: {
                id: expect.any(String),
                companyName: 'company found',
                country: 'CH',
                companyId: '123',
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
              },
              confidence: expect.any(Number),
              foundBy: expect.any(String),
            },
          ],
          messageCompaniesFoundInRepository,
        ]);
        found2 = await service.search({
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

      describe('and some returned companies have the same country and id', () => {
        beforeEach(() => {
          fetch.resetMocks();
          fetch.mockResponseOnce(
            JSON.stringify({
              companies: [
                {
                  companies: [
                    { company: { companyName: 'company 123', country: 'CH', companyId: '123' } },
                    { company: { companyName: 'company 123', country: 'CH', companyId: '123', isic: 'isic' } },
                    { company: { companyName: 'company 456', country: 'CH', companyId: '456' } },
                    { company: { companyName: 'company 456', country: 'CH', companyId: '456' } },
                  ],
                },
              ],
              message: 'Message from ScraperService',
            }),
          );
        });

        // TODO: Fix the code so that this test returns just one record (the most recent one)
        // per <country, companyId>. It can be unexpected behaviour that in this test we return 3 records,
        // but we are only able to find two afterwards.
        it('should find and create one record per company', async () => {
          const wantFirstCompanyOldRecord = {
            id: expect.any(String),
            companyName: 'company 123',
            created: expect.any(Date),
            lastUpdated: expect.any(Date),
            country: 'CH',
            companyId: '123',
          };
          // Same company, but it is a different record because of the different isic.
          const wantFirstCompanyMostRecentRecord = {
            id: expect.any(String),
            companyName: 'company 123',
            created: expect.any(Date),
            lastUpdated: expect.any(Date),
            country: 'CH',
            companyId: '123',
            isic: 'isic',
          };
          // The ScraperService returns two records for this company, but we are able
          // to deduplicate them because they contain the same content, so we are able to dedup them.
          const wantSecondCompanyOnlyRecord = {
            id: expect.any(String),
            companyName: 'company 456',
            created: expect.any(Date),
            lastUpdated: expect.any(Date),
            country: 'CH',
            companyId: '456',
          };

          const found = await service.search({ companyName: 'irrelevant' });
          expect(found).toEqual([
            [
              { company: wantFirstCompanyOldRecord },
              { company: wantFirstCompanyMostRecentRecord },
              { company: wantSecondCompanyOnlyRecord },
            ],
            'Message from ScraperService',
          ]);

          const firstReturnedRecord = found[0][0];
          const secondReturnedRecord = found[0][1];
          const thirdReturnedRecord = found[0][2];

          const expectations: [SearchDto, {}][] = [
            [
              {
                country: firstReturnedRecord.company.country,
                companyId: firstReturnedRecord.company.companyId,
              },
              wantFirstCompanyMostRecentRecord,
            ],
            [
              {
                country: secondReturnedRecord.company.country,
                companyId: secondReturnedRecord.company.companyId,
              },
              wantFirstCompanyMostRecentRecord,
            ],
            [
              {
                country: thirdReturnedRecord.company.country,
                companyId: thirdReturnedRecord.company.companyId,
              },
              wantSecondCompanyOnlyRecord,
            ],
          ];

          for (const [searchDto, want] of expectations) {
            const found2 = await service.search(searchDto);
            expect(found2).toEqual([
              [
                {
                  company: want,
                  confidence: expect.any(Number),
                  foundBy: expect.any(String),
                },
              ],
              messageCompaniesFoundInRepository,
            ]);
          }
        });
      });

      describe('and results contain a confidence value', () => {
        beforeEach(() => {
          fetch.resetMocks();
          fetch.mockResponseOnce(
            JSON.stringify({
              companies: [
                {
                  companies: [
                    { company: { companyName: '1', companyId: '1', country: 'CH' }, confidence: 0.5 },
                    { company: { companyName: '2', companyId: '2', country: 'CH' }, confidence: 0.7 },
                    { company: { companyName: '3', companyId: '3', country: 'CH' }, confidence: 0.9 },
                    { company: { companyName: '4', companyId: '4', country: 'CH' }, confidence: 0.6 },
                    { company: { companyName: '5', companyId: '5', country: 'CH' } },
                  ],
                },
              ],
            }),
          );
        });
        it('results should be sorted by confidence in descending order', async () => {
          const [found] = await service.search({ companyName: 'irrelevant' });
          expect(found).toEqual([
            {
              company: {
                companyName: '3',
                companyId: '3',
                country: 'CH',
                id: expect.any(String),
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
              },
              confidence: 0.9,
            },
            {
              company: {
                companyName: '2',
                companyId: '2',
                country: 'CH',
                id: expect.any(String),
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
              },
              confidence: 0.7,
            },
            {
              company: {
                companyName: '4',
                companyId: '4',
                country: 'CH',
                id: expect.any(String),
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
              },
              confidence: 0.6,
            },
            {
              company: {
                companyName: '1',
                companyId: '1',
                country: 'CH',
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
                companyId: '5',
                country: 'CH',
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
      const inputSearchDtos = [{ country: 'CH', companyId: '1' }, { companyName: '1' }];
      for (const searchDto of inputSearchDtos) {
        it(`and we search for ${JSON.stringify(searchDto)}, should not find a company`, async () => {
          expect(await service.search(searchDto)).toEqual([[], 'Message from ScraperService']);
        });
      }
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
            companies: [
              { companies: [{ company: { companyName: 'company found', country: 'CH', companyId: '123' } }] },
            ],
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
                country: 'CH',
                companyId: '123',
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
