// Copyright 2022 Meta Mind AB
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
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
import fetch from 'node-fetch';
import { CompanyDbObject, CompanyDocument } from './repository/mongo/company.schema';
import { SearchDto } from './dto/search.dto';
import { IncomingRequestDbObject, IncomingRequestDocument } from './repository/mongo/incoming-request.schema';
import { RequestType } from './repository/mongo/incoming-request.model';
import { InsertOrUpdateDto } from './dto/insert-or-update.dto';
import { RepoService } from './services/repo.service';
import { ScraperService } from './services/scraper.service';

describe('CompanyService', () => {
  const messageCompaniesFoundInRepository = 'Companies were found in repository';
  const messageAtTimeWasSet = 'No companies found; request not sent to the ScraperService because "atTime" was set';
  const foundByRepoByTaxId = 'Repository by taxId';
  const foundByRepoByName = 'Repository by name';
  const foundByRepoByOrgNbr = 'Repository by orgNbr and country';
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
        RepoService,
        ScraperService,
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

  describe('the countCompanies method', () => {
    it('should count distinct companies', async () => {
      // They are all different companies because taxId is different.
      await service.insertOrUpdate({ country: 'CH', taxId: '1', companyName: '1' });
      expect(await service.countCompanies({})).toEqual(1);
      await service.insertOrUpdate({ country: 'CH', taxId: '2', companyName: '2' });
      expect(await service.countCompanies({})).toEqual(2);
      await service.insertOrUpdate({ country: 'CH', taxId: '3', companyName: '3' });
      expect(await service.countCompanies({})).toEqual(3);
    });

    describe('should count companies that match specific fields', () => {
      beforeEach(async () => {
        await service.insertOrUpdate({ country: 'CH', taxId: '1', companyName: '1' });
        await service.insertOrUpdate({ country: 'CH', taxId: '2', companyName: '2' });
        await service.insertOrUpdate({ country: 'CH', taxId: '3', companyName: '3' });
      });

      it('by country', async () => {
        expect(await service.countCompanies({ country: 'CH' })).toEqual(3);
        expect(await service.countCompanies({ country: 'DK' })).toEqual(0);
      });

      it('by all previous names', async () => {
        expect(await service.countCompanies({ companyName: '1' })).toEqual(1);
        expect(await service.countCompanies({ companyName: '2' })).toEqual(1);
        expect(await service.countCompanies({ companyName: '3' })).toEqual(1);
      });
    });

    it('should count companies, not records', async () => {
      await service.insertOrUpdate({ country: 'CH', taxId: '1', companyName: '1' });
      expect(await service.countCompanies({})).toEqual(1);
      await service.insertOrUpdate({ country: 'CH', taxId: '2', companyName: '2' });
      expect(await service.countCompanies({})).toEqual(2);
      // Same taxId, so it's considered the same company as the first request.
      await service.insertOrUpdate({ country: 'CH', taxId: '1', companyName: '3' });
      expect(await service.countCompanies({})).toEqual(2);
    });

    it('should not count deleted companies', async () => {
      const [company, _] = await service.insertOrUpdate({ country: 'CH', taxId: '1', companyName: '1' });
      expect((await service.listAllForTesting()).length).toEqual(1);
      await service.markDeleted({ companyId: company.companyId });
      expect((await service.listAllForTesting()).length).toEqual(2);
      expect(await service.countCompanies({})).toEqual(0);

      await service.insertOrUpdate({ country: 'CH', taxId: '1', companyName: '1' });
      expect((await service.listAllForTesting()).length).toEqual(3);
      expect(await service.countCompanies({})).toEqual(1);
    });

    it('should count historical companies if `atTime` is set', async () => {
      const [oldestCompany] = await service.insertOrUpdate({ country: 'CH', taxId: '1', companyName: '1' });
      const [middleCompany] = await service.insertOrUpdate({ country: 'CH', taxId: '2', companyName: '2' });
      const [mostRecentCompany] = await service.insertOrUpdate({ country: 'CH', taxId: '3', companyName: '3' });
      expect(await service.countCompanies({})).toEqual(3);

      expect(await service.countCompanies({ atTime: new Date(oldestCompany.created.getTime() - 1) })).toEqual(0);
      expect(await service.countCompanies({ atTime: oldestCompany.created })).toEqual(1);
      expect(await service.countCompanies({ atTime: new Date(middleCompany.created.getTime() - 1) })).toEqual(1);
      expect(await service.countCompanies({ atTime: middleCompany.created })).toEqual(2);
      expect(await service.countCompanies({ atTime: new Date(mostRecentCompany.created.getTime() - 1) })).toEqual(2);
      expect(await service.countCompanies({ atTime: mostRecentCompany.created })).toEqual(3);
    });

    it('should not count historical companies that are deleted', async () => {
      const [oldestCompany] = await service.insertOrUpdate({ country: 'CH', taxId: '1', companyName: '1' });
      expect(await service.countCompanies({})).toEqual(1);
      const [deleted] = await service.markDeleted({ companyId: oldestCompany.companyId });
      expect(await service.countCompanies({})).toEqual(0);
      const [mostRecentCompany] = await service.insertOrUpdate({ country: 'CH', taxId: '3', companyName: '3' });
      expect(await service.countCompanies({})).toEqual(1);

      expect(await service.countCompanies({ atTime: new Date(oldestCompany.created.getTime() - 1) })).toEqual(0);
      expect(await service.countCompanies({ atTime: oldestCompany.created })).toEqual(1);
      expect(await service.countCompanies({ atTime: new Date(deleted.created.getTime() - 1) })).toEqual(1);
      expect(await service.countCompanies({ atTime: deleted.created })).toEqual(0);
      expect(await service.countCompanies({ atTime: new Date(mostRecentCompany.created.getTime() - 1) })).toEqual(0);
      expect(await service.countCompanies({ atTime: mostRecentCompany.created })).toEqual(1);
    });
  });

  it('should list all companies', async () => {
    // We first need to create a few companies.
    await service.insertOrUpdate({ country: 'CH', taxId: '1', companyName: '1' });
    await service.insertOrUpdate({ country: 'CH', taxId: '2', companyName: '2' });
    await service.insertOrUpdate({ country: 'CH', taxId: '3', companyName: '3' });

    expect(await service.listAllForTesting()).toEqual([
      {
        id: expect.any(String),
        companyId: expect.any(String),
        country: 'CH',
        taxId: '1',
        companyName: '1',
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
      },
      {
        id: expect.any(String),
        companyId: expect.any(String),
        country: 'CH',
        taxId: '2',
        companyName: '2',
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
      },
      {
        id: expect.any(String),
        companyId: expect.any(String),
        country: 'CH',
        taxId: '3',
        companyName: '3',
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
      },
    ]);
  });

  describe('the insertOrUpdate method', () => {
    // Format of testCases: title, request.
    const testCases: [string, any][] = [
      ['requires at least one id field', { country: 'irrelevant' }],
      ['requires at least one id field with content', { country: 'irrelevant', taxId: '' }],
    ];
    for (const [title, request] of testCases) {
      it(title, async () => {
        await expect(service.insertOrUpdate(request)).rejects.toThrowError(
          new RegExp(`Invalid insertOrUpdate request.*not enough identifiers.*`),
        );
      });
    }

    describe('should insert a new record for a non-existent company', () => {
      // Format of testCases: title, request.
      const testCases: [string, any][] = [
        ['if we send Tax ID', { taxId: '1' }],
        ['if we send OrgNbr', { orgNbr: '1' }],
        ['if we send Tax ID an orgNbr', { taxId: '1', orgNbr: '2' }],
      ];
      for (const [title, request] of testCases) {
        it(title, async () => {
          const company = { country: 'CH', companyName: 'name1', dataSource: 'Unit-Test', isic: 'isic', ...request };

          const wantInDb = {
            id: expect.any(String),
            companyId: expect.any(String),
            country: company.country,
            companyName: company.companyName,
            created: expect.any(Date),
            lastUpdated: expect.any(Date),
            dataSource: 'Unit-Test',
            isic: 'isic',
            ...request, // Take advantage of the fact that the fields in the request and the db have the same name.
          };
          expect(await service.insertOrUpdate(company)).toEqual([wantInDb, expect.stringContaining('Inserted')]);
          expect(await service.listAllForTesting()).toEqual([wantInDb]);

          // Check that the incoming request was persisted.
          const wantIncomingRequestInDb = {
            country: company.country,
            companyName: company.companyName,
            created: expect.any(Date),
            dataSource: 'Unit-Test',
            isic: 'isic',
            requestType: requestTypeInsertOrUpdate,
            ...request,
          };
          expect(await service.listAllIncomingRequestsForTesting()).toEqual([wantIncomingRequestInDb]);
        });
      }
    });

    it('should not insert a new record if metadata did not change', async () => {
      const company = { country: 'CH', taxId: '1', companyName: 'name1' };

      const want = {
        id: expect.any(String),
        companyId: expect.any(String),
        country: company.country,
        taxId: company.taxId,
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
        taxId: company.taxId,
        companyName: company.companyName,
        created: expect.any(Date),
        requestType: requestTypeInsertOrUpdate,
      };
      expect(await service.listAllIncomingRequestsForTesting()).toEqual([
        wantIncomingRequestInDb,
        wantIncomingRequestInDb,
      ]);
    });

    describe('should insert a new record for updates to the same company', () => {
      // Format of testCases: title, request1, request2.
      const testCases: [string, any, any][] = [
        [
          'if the name changes',
          { country: 'CH', taxId: '1', companyName: 'Old Name LLC' },
          { country: 'CH', taxId: '1', companyName: 'New Name Inc' },
        ],
        [
          'if the record has taxId, and we add orgNbr later',
          { country: 'CH', taxId: '1' },
          { country: 'CH', taxId: '1', orgNbr: '2' },
        ],
        [
          'if the record has orgNbr, and we add taxId later',
          { country: 'CH', orgNbr: '1' },
          { country: 'CH', orgNbr: '1', taxId: '2' },
        ],
      ];
      for (const [title, request1, request2] of testCases) {
        it(title, async () => {
          const want1 = {
            id: expect.any(String),
            companyId: expect.any(String),
            created: expect.any(Date),
            lastUpdated: expect.any(Date),
            ...request1,
          };

          const [company1, string1] = await service.insertOrUpdate(request1);
          expect([company1, string1]).toEqual([want1, expect.stringContaining('Inserted')]);
          expect(await service.listAllForTesting()).toEqual([want1]);

          const want2 = {
            id: expect.any(String),
            companyId: company1.companyId,
            created: expect.any(Date),
            lastUpdated: expect.any(Date),
            ...request2,
          };

          expect(await service.insertOrUpdate(request2)).toEqual([want2, expect.stringContaining('Updated')]);
          expect(await service.listAllForTesting()).toEqual([want1, want2]);
          expect(await service.insertOrUpdate(request2)).toEqual([
            want2,
            expect.stringContaining('Marked as up-to-date'),
          ]);
          expect(await service.listAllForTesting()).toEqual([want1, want2]);

          // Check that all incoming requests were persisted.
          const wantIncomingRequest1 = {
            created: expect.any(Date),
            requestType: requestTypeInsertOrUpdate,
            ...request1,
          };
          const wantIncomingRequest2 = {
            created: expect.any(Date),
            requestType: requestTypeInsertOrUpdate,
            ...request2,
          };
          expect(await service.listAllIncomingRequestsForTesting()).toEqual([
            wantIncomingRequest1,
            wantIncomingRequest2,
            wantIncomingRequest2,
          ]);
        });
      }
    });

    describe('should insert a record with a new company id', () => {
      // Format of testCases: title, request1, request2.
      const testCases: [string, any, any][] = [
        ['if we send a different Tax ID', { country: 'CH', taxId: '1' }, { country: 'CH', taxId: '2' }],
        [
          'if we send a different OrgNbr and the same country',
          { country: 'CH', orgNbr: '1' },
          { country: 'CH', orgNbr: '2' },
        ],
        [
          'if we send an existing OrgNbr and a different country',
          { country: 'CH', orgNbr: '1' },
          { country: 'DK', orgNbr: '1' },
        ],
      ];
      for (const [title, request1, request2] of testCases) {
        it(title, async () => {
          const metadata1 = { companyName: 'name1', dataSource: 'Unit-Test', isic: 'isic', ...request1 };
          const metadata2 = { companyName: 'name1', dataSource: 'Unit-Test', isic: 'isic', ...request2 };

          const [company1, string1] = await service.insertOrUpdate(metadata1);
          const wantInDb1 = {
            id: expect.any(String),
            companyId: company1.companyId,
            companyName: metadata1.companyName,
            created: expect.any(Date),
            lastUpdated: expect.any(Date),
            dataSource: 'Unit-Test',
            isic: 'isic',
            ...request1,
          };

          expect([company1, string1]).toEqual([wantInDb1, expect.stringContaining('Inserted')]);

          const wantInDb2 = {
            id: expect.any(String),
            companyId: expect.not.stringContaining(company1.companyId),
            companyName: metadata2.companyName,
            created: expect.any(Date),
            lastUpdated: expect.any(Date),
            dataSource: 'Unit-Test',
            isic: 'isic',
            ...request2,
          };
          expect(await service.insertOrUpdate(metadata2)).toEqual([wantInDb2, expect.stringContaining('Inserted')]);
          expect(await service.insertOrUpdate(metadata2)).toEqual([
            wantInDb2,
            expect.stringContaining('Marked as up-to-date'),
          ]);
          expect(await service.listAllForTesting()).toEqual([wantInDb1, wantInDb2]);
        });
      }
    });

    describe('and we try to insert data that conflicts with the data in the db', () => {
      // Format of testCases: title, insertOrUpdate requests, expected error string.
      const testCases: [string, InsertOrUpdateDto[], string][] = [
        [
          'we use different countries with the same Tax ID',
          [
            { country: 'DK', taxId: '1', companyName: 'DK 1' },
            { country: 'CH', taxId: '1', companyName: 'CH 1' },
          ],
          '.*Conflicting country: new: CH, existing: DK.*',
        ],
        [
          'we use different orgNbr with the same Tax ID',
          [
            { country: 'DK', taxId: '1', companyName: 'DK 1', orgNbr: '1' },
            { country: 'DK', taxId: '1', companyName: 'DK 1', orgNbr: '2' },
          ],
          '.*Conflicting orgNbr: new: 2, existing: 1.*',
        ],
        [
          'we use identifiers from two different companies',
          [
            { country: 'DK', taxId: '1', companyName: 'DK 1' },
            { country: 'DK', companyName: 'DK 1', orgNbr: '2' },
            { country: 'DK', taxId: '1', companyName: 'DK 1', orgNbr: '2' },
          ],
          '.*Multiple companies match the identifiers.*',
        ],
      ];

      for (const [title, requests, wantError] of testCases) {
        const lastRequest = requests[requests.length - 1];
        describe(`and ${title}`, () => {
          it('should throw error', async () => {
            // Insert all requests except the last one.
            for (let i = 0; i < requests.length - 1; i++) {
              expect(await service.insertOrUpdate(requests[i])).toEqual([
                expect.any(Company),
                expect.stringContaining('Inserted'),
              ]);
            }
            // The last request should fail.
            await expect(service.insertOrUpdate(lastRequest)).rejects.toThrowError(new RegExp(wantError));
          });

          it('should insert the company if we delete the conflicting companies first', async () => {
            const companyIds: string[] = [];
            // Insert all requests except the last one.
            for (let i = 0; i < requests.length - 1; i++) {
              const response = await service.insertOrUpdate(requests[i]);
              companyIds.push(response[0].companyId);
              expect(response).toEqual([expect.any(Company), expect.stringContaining('Inserted')]);
            }
            // The last request should fail.
            await expect(service.insertOrUpdate(lastRequest)).rejects.toThrowError(new RegExp(wantError));

            // The last request should succeed after deleting the problematic companies.
            for (const companyId of companyIds) {
              await service.markDeleted({ companyId });
            }
            expect(await service.countCompanies({})).toEqual(0);

            expect(await service.insertOrUpdate(lastRequest)).toEqual([
              expect.any(Company),
              expect.stringContaining('Inserted'),
            ]);
          });
        });
      }
    });
  });

  describe('the markDeleted method', () => {
    it('should throw an error if we try to delete a non-existent company', async () => {
      await expect(service.markDeleted({ companyId: 'non-existent-id' })).rejects.toThrowError(
        'Cannot find company to delete, unknown company: {"companyId":"non-existent-id"}',
      );
    });

    it('should delete an active company', async () => {
      const insertOrUpdateInput = { country: 'CH', taxId: '1', companyName: 'name1' };
      const [insertedCompany] = await service.insertOrUpdate(insertOrUpdateInput);

      const wantInitial = {
        id: expect.any(String),
        companyId: insertedCompany.companyId,
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
        country: insertOrUpdateInput.country,
        taxId: insertOrUpdateInput.taxId,
        companyName: insertOrUpdateInput.companyName,
      };
      const wantDelete = {
        id: expect.any(String),
        companyId: insertedCompany.companyId,
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
        isDeleted: true,
        country: expect.any(String),
      };
      expect(await service.markDeleted({ companyId: insertedCompany.companyId })).toEqual([
        wantDelete,
        expect.stringContaining('Marked as deleted'),
      ]);
      expect(await service.listAllForTesting()).toEqual([wantInitial, wantDelete]);

      // Check that all incoming requests were persisted.
      const wantIncomingRequest1 = {
        country: insertOrUpdateInput.country,
        taxId: insertOrUpdateInput.taxId,
        companyName: insertOrUpdateInput.companyName,
        created: expect.any(Date),
        requestType: requestTypeInsertOrUpdate,
      };

      const wantIncomingRequest2 = {
        companyId: insertedCompany.companyId,
        created: expect.any(Date),
        requestType: requestTypeMarkDeleted,
      };
      expect(await service.listAllIncomingRequestsForTesting()).toEqual([wantIncomingRequest1, wantIncomingRequest2]);
    });

    it('should update the latest delete record for an already-deleted company', async () => {
      const insertOrUpdateInput = { country: 'CH', taxId: '1', companyName: 'name1' };
      const [insertedCompany] = await service.insertOrUpdate(insertOrUpdateInput);
      await service.markDeleted({ companyId: insertedCompany.companyId });

      const wantInitial = {
        id: expect.any(String),
        companyId: insertedCompany.companyId,
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
        country: insertOrUpdateInput.country,
        taxId: insertOrUpdateInput.taxId,
        companyName: insertOrUpdateInput.companyName,
      };
      const wantDelete = {
        id: expect.any(String),
        companyId: insertedCompany.companyId,
        created: expect.any(Date),
        lastUpdated: expect.any(Date),
        isDeleted: true,
        country: expect.any(String),
      };

      // The return value and the db contents should reflect a change in `lastUpdated` time.
      const result = await service.markDeleted({ companyId: insertedCompany.companyId });
      expect(result).toEqual([wantDelete, expect.stringContaining('Marked as up-to-date')]);
      expect(result[0].lastUpdated.getTime()).toBeGreaterThan(result[0].created.getTime());
      const dbContents = await service.listAllForTesting();
      expect(dbContents).toEqual([wantInitial, wantDelete]);
      expect(dbContents[1].lastUpdated.getTime()).toBeGreaterThan(dbContents[1].created.getTime());

      // Check that all incoming requests were persisted.
      const wantIncomingRequest1 = {
        country: insertOrUpdateInput.country,
        taxId: insertOrUpdateInput.taxId,
        companyName: insertOrUpdateInput.companyName,
        created: expect.any(Date),
        requestType: requestTypeInsertOrUpdate,
      };

      const wantIncomingRequest2 = {
        companyId: insertedCompany.companyId,
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
        await service.insertOrUpdate({ companyName: 'name1', taxId: '123', country: 'CH', orgNbr: '456' });
      });

      const testCasesLocalIds: [string, SearchDto][] = [['org nbr', { orgNbr: '456' }]];
      const testCasesLocalIdsAndCountry = testCasesLocalIds.map(function (
        value: [string, SearchDto],
      ): [string, SearchDto] {
        return [`${value[0]} and country`, { ...value[1], country: 'CH' }];
      });

      const testCases: [string, SearchDto][] = [
        ['tax id', { taxId: '123' }],
        ['company name', { companyName: 'name1' }],
        ...testCasesLocalIdsAndCountry,
      ];
      for (const [title, searchDto] of testCases) {
        it(`and we search by ${title}, should find the record`, async () => {
          const found = await service.search(searchDto);
          expect(found).toEqual([
            [
              {
                company: {
                  id: expect.any(String),
                  companyId: expect.any(String),
                  companyName: 'name1',
                  taxId: '123',
                  country: 'CH',
                  orgNbr: '456',
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

      for (const [title, searchDto] of testCasesLocalIds) {
        it(`and we search by local id ${title} without country, should not find the record`, async () => {
          const [found] = await service.search(searchDto);
          expect(found).toEqual([]);
        });
      }
    });

    describe('when there are multiple companies with the same local identifiers but different countries', () => {
      beforeEach(async () => {
        await service.insertOrUpdate({ companyName: 'name1', taxId: '1', country: 'CH', orgNbr: '456' });
        await service.insertOrUpdate({ companyName: 'name1', taxId: '2', country: 'DK', orgNbr: '456' });
      });

      const testCases: [string, SearchDto][] = [['org nbr and country', { country: 'CH', orgNbr: '456' }]];
      for (const [title, searchDto] of testCases) {
        it(`and we search by ${title}, should find the record for the specific country`, async () => {
          const found = await service.search(searchDto);
          expect(found).toEqual([
            [
              {
                company: {
                  id: expect.any(String),
                  companyId: expect.any(String),
                  companyName: 'name1',
                  taxId: '1',
                  country: 'CH',
                  orgNbr: '456',
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
      let tcReferences: object;

      beforeEach(async () => {
        [firstRecord] = await service.insertOrUpdate({ companyName: '1', taxId: '123', country: 'CH' });
        [secondRecord] = await service.insertOrUpdate({ companyName: '2', taxId: '123', country: 'CH', orgNbr: '456' });
        [mostRecent] = await service.insertOrUpdate({ companyName: '3', taxId: '123', country: 'CH' });

        // We can only refer to objects inside `it` blocks. This is a challenge with the tests inside
        // this section because we cannot have nice table-driven test cases of the form "If the request
        // is at time firstRecord.created, then I should get object firstRecord".
        // As a workaround we define these test cases using strings which refer to fields of `tcReferences`,
        // and we get the real objects inside the tests with `Reflect.get(tcReferences, `${myString}`);`
        tcReferences = {
          firstRecordCreated: firstRecord.created,
          secondRecordCreated: secondRecord.created,
          mostRecentCreated: mostRecent.created,
          beforeSecondRecord: new Date(secondRecord.created.getTime() - 1),
          beforeMostRecent: new Date(mostRecent.created.getTime() - 1),
          afterMostRecent: new Date(mostRecent.created.getTime() + 5000),
          firstRecord: [
            [
              {
                confidence: expect.any(Number),
                foundBy: expect.any(String),
                company: firstRecord,
              },
            ],
            messageCompaniesFoundInRepository,
          ],
          secondRecord: [
            [
              {
                confidence: expect.any(Number),
                foundBy: expect.any(String),
                company: secondRecord,
              },
            ],
            messageCompaniesFoundInRepository,
          ],
          mostRecent: [
            [
              {
                confidence: expect.any(Number),
                foundBy: expect.any(String),
                company: mostRecent,
              },
            ],
            messageCompaniesFoundInRepository,
          ],
          noRecord: [[], messageAtTimeWasSet],
        };
      });

      const tcNoAtTime: [string, SearchDto, string][] = [
        ['tax id', { taxId: '123' }, foundByRepoByTaxId],
        ['first company name', { companyName: '1' }, foundByRepoByName],
        ['second company name', { companyName: '2' }, foundByRepoByName],
        ['most recent company name', { companyName: '3' }, foundByRepoByName],
        ['org nbr and country', { country: 'CH', orgNbr: '456' }, foundByRepoByOrgNbr],
      ];
      for (const [title, searchDto, wantFoundBy] of tcNoAtTime) {
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
      }

      // Format: title, searchDto, requestDate, wantOutput.
      // `requestDate` and `wantOutput` refer to variable names of `tcReferences`.
      const tcHistorical: [string, SearchDto, string, string][] = [
        ['tax id', { taxId: '123' }, 'firstRecordCreated', 'firstRecord'],
        ['tax id', { taxId: '123' }, 'beforeSecondRecord', 'firstRecord'],
        ['tax id', { taxId: '123' }, 'secondRecordCreated', 'secondRecord'],
        ['tax id', { taxId: '123' }, 'beforeMostRecent', 'secondRecord'],
        ['tax id', { taxId: '123' }, 'mostRecentCreated', 'mostRecent'],
        ['tax id', { taxId: '123' }, 'afterMostRecent', 'mostRecent'],

        // Companies can change names. Make sure that we can always find a company by an older name.
        ['first company name', { companyName: '1' }, 'firstRecordCreated', 'firstRecord'],
        ['first company name', { companyName: '1' }, 'beforeSecondRecord', 'firstRecord'],
        ['first company name', { companyName: '1' }, 'secondRecordCreated', 'secondRecord'],
        ['first company name', { companyName: '1' }, 'beforeMostRecent', 'secondRecord'],
        ['first company name', { companyName: '1' }, 'mostRecentCreated', 'mostRecent'],
        ['first company name', { companyName: '1' }, 'afterMostRecent', 'mostRecent'],

        // Make sure that an old historical query cannot find companies by a newer name.
        // companyName '2' is added in the second record, we should not be able to find it before that.
        ['second company name', { companyName: '2' }, 'firstRecordCreated', 'noRecord'],
        ['second company name', { companyName: '2' }, 'beforeSecondRecord', 'noRecord'],
        ['second company name', { companyName: '2' }, 'secondRecordCreated', 'secondRecord'],
        ['second company name', { companyName: '2' }, 'beforeMostRecent', 'secondRecord'],
        ['second company name', { companyName: '2' }, 'mostRecentCreated', 'mostRecent'],
        ['second company name', { companyName: '2' }, 'afterMostRecent', 'mostRecent'],

        // companyName '3' is added in the mostRecent record.
        ['most recent company name', { companyName: '3' }, 'firstRecordCreated', 'noRecord'],
        ['most recent company name', { companyName: '3' }, 'beforeSecondRecord', 'noRecord'],
        ['most recent company name', { companyName: '3' }, 'secondRecordCreated', 'noRecord'],
        ['most recent company name', { companyName: '3' }, 'beforeMostRecent', 'noRecord'],
        ['most recent company name', { companyName: '3' }, 'mostRecentCreated', 'mostRecent'],
        ['most recent company name', { companyName: '3' }, 'afterMostRecent', 'mostRecent'],

        // Companies can add org nbrs. '456' is added in secondRecord.
        ['org nbr and country', { country: 'CH', orgNbr: '456' }, 'firstRecordCreated', 'noRecord'],
        ['org nbr and country', { country: 'CH', orgNbr: '456' }, 'beforeSecondRecord', 'noRecord'],
        ['org nbr and country', { country: 'CH', orgNbr: '456' }, 'secondRecordCreated', 'secondRecord'],
        ['org nbr and country', { country: 'CH', orgNbr: '456' }, 'beforeMostRecent', 'secondRecord'],
        // "mostRecent" does not have an orgNbr, but we're still able to find it from an older record.
        ['org nbr and country', { country: 'CH', orgNbr: '456' }, 'mostRecentCreated', 'mostRecent'],
        ['org nbr and country', { country: 'CH', orgNbr: '456' }, 'afterMostRecent', 'mostRecent'],
      ];

      // Note: these unit tests use the real clock and may show up as flakey in the
      // unlikely case that the records above were created at the same millisecond.
      for (const [title, searchDto, requestDate, wantOutput] of tcHistorical) {
        it(`and we search by ${title} and time=${requestDate}, should return ${wantOutput}`, async () => {
          const want = Reflect.get(tcReferences, `${wantOutput}`);
          const t = Reflect.get(tcReferences, `${requestDate}`);

          expect(await service.search({ ...searchDto, atTime: t })).toEqual(want);
        });
      }
    });

    describe('when there are historical deleted records', () => {
      let dbContents: Company[];
      let wantInserted1;
      let wantInserted2;

      beforeEach(async () => {
        const insertOrUpdateInput = { country: 'CH', taxId: '1', companyName: 'name1', orgNbr: '456' };
        const [insertedCompany1] = await service.insertOrUpdate(insertOrUpdateInput);
        await service.markDeleted({ companyId: insertedCompany1.companyId });
        await service.insertOrUpdate(insertOrUpdateInput);

        wantInserted1 = {
          id: expect.any(String),
          companyId: insertedCompany1.companyId,
          created: expect.any(Date),
          lastUpdated: expect.any(Date),
          country: insertOrUpdateInput.country,
          taxId: insertOrUpdateInput.taxId,
          orgNbr: insertOrUpdateInput.orgNbr,
          companyName: insertOrUpdateInput.companyName,
        };
        // The second insertOrUpdate operation creates a new company because the first
        // one is deleted (and thus it's ignored). We've used the same request, so the
        // only difference is the generated id.
        wantInserted2 = { ...wantInserted1, companyId: expect.not.stringContaining(insertedCompany1.companyId) };

        const wantDeleted = {
          id: expect.any(String),
          companyId: insertedCompany1.companyId,
          created: expect.any(Date),
          lastUpdated: expect.any(Date),
          isDeleted: true,
          country: expect.any(String),
        };
        dbContents = await service.listAllForTesting();
        expect(dbContents).toEqual([wantInserted1, wantDeleted, wantInserted2]);
      });

      const testCases: [string, SearchDto, string][] = [
        ['tax id', { taxId: '1' }, foundByRepoByTaxId],
        ['company name', { companyName: 'name1' }, foundByRepoByName],
        ['org nbr and country', { country: 'CH', orgNbr: '456' }, foundByRepoByOrgNbr],
      ];

      for (const [title, searchDto, wantFoundBy] of testCases) {
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
                company: wantInserted1,
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
                company: wantInserted2,
              },
            ],
            messageCompaniesFoundInRepository,
          ]);
        });
      }
    });

    it('should not contact scraper service for historical queries', async () => {
      expect(await service.search({ country: 'DK', taxId: '42', atTime: new Date('2020') })).toEqual([
        [],
        messageAtTimeWasSet,
      ]);
      expect(fetch).not.toHaveBeenCalled();
    });

    describe('when there are multiple companies with multiple records each', () => {
      beforeEach(async () => {
        // These records correspond to the same company because country and taxId are the same.
        // In order to create a new record we need the company metadata to change.
        // We cannot change companyName because we want to search by that, so we use a different arbitrary field (isic).
        await service.insertOrUpdate({ country: 'CH', taxId: '1', companyName: 'name', isic: 'original' });
        await service.insertOrUpdate({ country: 'CH', taxId: '1', companyName: 'name', isic: 'updated' });
        await service.insertOrUpdate({ country: 'CH', taxId: '2', companyName: 'name', isic: 'original' });
        await service.insertOrUpdate({ country: 'CH', taxId: '2', companyName: 'name', isic: 'updated' });
      });

      const testCases: [string, SearchDto, string][] = [['company name', { companyName: 'name' }, foundByRepoByName]];

      for (const [title, searchDto, wantFoundBy] of testCases) {
        it(`and we search by ${title} and no 'atTime', should return the last record for each company`, async () => {
          const [found] = await service.search(searchDto);
          expect(found).toEqual([
            {
              company: {
                id: expect.any(String),
                companyId: expect.any(String),
                country: 'CH',
                taxId: '1',
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
                companyId: expect.any(String),
                country: 'CH',
                taxId: '2',
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
      await service.insertOrUpdate({ country: 'CH', taxId: '1', companyName: '1' });

      const [found] = await service.search({
        country: 'CH',
        taxId: 'something-different-from-1',
        companyName: '1',
      });
      expect(found).toEqual([
        {
          company: {
            id: expect.any(String),
            companyId: expect.any(String),
            country: 'CH',
            taxId: '1',
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
      await service.insertOrUpdate({ country: 'CH', taxId: '1', companyName: '1' });

      const [found] = await service.search({ country: 'CH', taxId: '1' });
      expect(found).toEqual([
        {
          company: {
            id: expect.any(String),
            companyId: expect.any(String),
            country: 'CH',
            taxId: '1',
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
      await service.insertOrUpdate({ country: 'CH', taxId: '2', companyName: 'name-to-search-for' });
      await service.insertOrUpdate({ country: 'CH', taxId: 'id-to-search-for', companyName: '1' });

      const [found] = await service.search({
        taxId: 'id-to-search-for',
        country: 'CH',
        companyName: 'name-to-search-for',
      });
      expect(found).toEqual([
        // The ranking of confidences are: (1) match by taxId and country, and (2) match by name.
        {
          company: {
            id: expect.any(String),
            companyId: expect.any(String),
            country: 'CH',
            taxId: 'id-to-search-for',
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
            companyId: expect.any(String),
            country: 'CH',
            taxId: '2',
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
      await service.insertOrUpdate({ country: 'CH', taxId: '123', companyName: '1', orgNbr: '456' });

      // This request matches the data by multiple fields. Make sure only one item is returned, and
      // it has the highest confidence of all fields.
      const [found] = await service.search({ companyName: '1', taxId: '123', country: 'CH', orgNbr: '456' });
      expect(found).toEqual([
        {
          company: {
            id: expect.any(String),
            companyId: expect.any(String),
            companyName: '1',
            taxId: '123',
            orgNbr: '456',
            country: 'CH',
            created: expect.any(Date),
            lastUpdated: expect.any(Date),
          },
          confidence: expect.any(Number),
          foundBy: foundByRepoByTaxId,
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
                    company: { companyName: 'company found', country: 'CH', taxId: '456', dataSource: 'Unit-Test' },
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
                companyId: expect.any(String),
                companyName: 'company found',
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
                country: 'CH',
                taxId: '456',
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
          taxId: found[0][0].company.taxId,
        });
        expect(found).toEqual([
          [
            {
              company: {
                id: expect.any(String),
                companyId: expect.any(String),
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
                country: 'CH',
                taxId: '456',
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
                  { company: { companyName: 'company found', country: 'CH', taxId: '123' } },
                  { company: { companyName: 'another company found', country: 'CH', taxId: '456' } },
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
                companyId: expect.any(String),
                companyName: 'company found',
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
                country: 'CH',
                taxId: '123',
              },
            },
            {
              company: {
                id: expect.any(String),
                companyId: expect.any(String),
                companyName: 'another company found',
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
                country: 'CH',
                taxId: '456',
              },
            },
          ],
          'Message from ScraperService',
        ]);
        let found2 = await service.search({
          country: found[0][0].company.country,
          taxId: found[0][0].company.taxId,
        });
        expect(found2).toEqual([
          [
            {
              company: {
                id: expect.any(String),
                companyId: expect.any(String),
                companyName: 'company found',
                country: 'CH',
                taxId: '123',
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
          taxId: found[0][1].company.taxId,
        });
        expect(found2).toEqual([
          [
            {
              company: {
                id: expect.any(String),
                companyId: expect.any(String),
                companyName: 'another company found',
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
                country: 'CH',
                taxId: '456',
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
                    { company: { companyName: 'company 123', country: 'CH', taxId: '123' } },
                    { company: { companyName: 'company 123', country: 'CH', taxId: '123', isic: 'isic' } },
                    { company: { companyName: 'company 456', country: 'CH', taxId: '456' } },
                    { company: { companyName: 'company 456', country: 'CH', taxId: '456' } },
                  ],
                },
              ],
              message: 'Message from ScraperService',
            }),
          );
        });

        // TODO: Fix the code so that this test returns just one record (the most recent one)
        // per <country, taxId>. It can be unexpected behaviour that in this test we return 3 records,
        // but we are only able to find two afterwards.
        it('should find and create one record per company', async () => {
          const wantFirstCompanyOldRecord = {
            id: expect.any(String),
            companyId: expect.any(String),
            companyName: 'company 123',
            created: expect.any(Date),
            lastUpdated: expect.any(Date),
            country: 'CH',
            taxId: '123',
          };
          // Same company, but it is a different record because of the different isic.
          const wantFirstCompanyMostRecentRecord = {
            id: expect.any(String),
            companyId: expect.any(String),
            companyName: 'company 123',
            created: expect.any(Date),
            lastUpdated: expect.any(Date),
            country: 'CH',
            taxId: '123',
            isic: 'isic',
          };
          // The ScraperService returns two records for this company, but we are able
          // to deduplicate them because they contain the same content, so we are able to dedup them.
          const wantSecondCompanyOnlyRecord = {
            id: expect.any(String),
            companyId: expect.any(String),
            companyName: 'company 456',
            created: expect.any(Date),
            lastUpdated: expect.any(Date),
            country: 'CH',
            taxId: '456',
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

          const testCases: [SearchDto, {}][] = [
            [
              {
                country: firstReturnedRecord.company.country,
                taxId: firstReturnedRecord.company.taxId,
              },
              wantFirstCompanyMostRecentRecord,
            ],
            [
              {
                country: secondReturnedRecord.company.country,
                taxId: secondReturnedRecord.company.taxId,
              },
              wantFirstCompanyMostRecentRecord,
            ],
            [
              {
                country: thirdReturnedRecord.company.country,
                taxId: thirdReturnedRecord.company.taxId,
              },
              wantSecondCompanyOnlyRecord,
            ],
          ];

          for (const [searchDto, want] of testCases) {
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
                    { company: { companyName: '1', taxId: '1', country: 'CH' }, confidence: 0.5 },
                    { company: { companyName: '2', taxId: '2', country: 'CH' }, confidence: 0.7 },
                    { company: { companyName: '3', taxId: '3', country: 'CH' }, confidence: 0.9 },
                    { company: { companyName: '4', taxId: '4', country: 'CH' }, confidence: 0.6 },
                    { company: { companyName: '5', taxId: '5', country: 'CH' } },
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
                taxId: '3',
                country: 'CH',
                id: expect.any(String),
                companyId: expect.any(String),
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
              },
              confidence: 0.9,
            },
            {
              company: {
                companyName: '2',
                taxId: '2',
                country: 'CH',
                id: expect.any(String),
                companyId: expect.any(String),
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
              },
              confidence: 0.7,
            },
            {
              company: {
                companyName: '4',
                taxId: '4',
                country: 'CH',
                id: expect.any(String),
                companyId: expect.any(String),
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
              },
              confidence: 0.6,
            },
            {
              company: {
                companyName: '1',
                taxId: '1',
                country: 'CH',
                id: expect.any(String),
                companyId: expect.any(String),
                created: expect.any(Date),
                lastUpdated: expect.any(Date),
              },
              confidence: 0.5,
            },
            // Items without confidences come last.
            {
              company: {
                companyName: '5',
                taxId: '5',
                country: 'CH',
                id: expect.any(String),
                companyId: expect.any(String),
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
      const inputSearchDtos = [{ country: 'CH', taxId: '1' }, { companyName: '1' }];
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
        await expect(service.search({ country: 'irrelevant', taxId: 'irrelevant' })).rejects.toThrowError(
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
        await expect(service.search({ country: 'irrelevant', taxId: 'irrelevant' })).rejects.toThrowError(
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
        expect(await service.search({ country: 'irrelevant', taxId: 'irrelevant' })).toEqual([
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
            companies: [{ companies: [{ company: { companyName: 'company found', country: 'CH', taxId: '123' } }] }],
            message: 'Some message',
          }),
        );
      });
      it('should return the message  and the companies', async () => {
        expect(await service.search({ country: 'irrelevant', taxId: 'irrelevant' })).toEqual([
          [
            {
              company: {
                id: expect.any(String),
                companyId: expect.any(String),
                companyName: 'company found',
                country: 'CH',
                taxId: '123',
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
        await expect(service.search({ country: 'irrelevant', taxId: 'irrelevant' })).rejects.toThrowError(
          new RegExp('Error parsing response from ScraperService.*'),
        );
        // We don't want to assert on the full string:
        // `Error parsing response from ScraperService: TypeError: response.companies is not iterable`
        // in case the way the type error is reported changes.
      });
    });

    it('should throw error if we did not ask for any field', async () => {
      await service.insertOrUpdate({ country: 'CH', taxId: '1', companyName: '1' });
      await service.insertOrUpdate({ country: 'DK', taxId: '45', companyName: '2' });
      await service.insertOrUpdate({ country: 'US', taxId: '60', companyName: '3' });

      await expect(service.search({})).rejects.toThrowError('Search request cannot be empty');
    });
  });
});
