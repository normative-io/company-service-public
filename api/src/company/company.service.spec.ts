import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CompanyRepositoryArray } from './repository/repository-array';
import { COMPANY_REPOSITORY } from './repository/repository-interface';
import { CompanyService } from './company.service';
import { TestMetrics } from './test-utils/company-service-metrics';
import { HttpModule, HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { of } from 'rxjs';
import { ConfigModule } from '@nestjs/config';

describe('CompanyService', () => {
  let service: CompanyService;
  let httpService: HttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule, ConfigModule.forRoot()],
      providers: [
        CompanyService,
        {
          provide: COMPANY_REPOSITORY,
          useClass: CompanyRepositoryArray,
        },
        ...TestMetrics,
      ],
    }).compile();

    service = module.get<CompanyService>(CompanyService);
    httpService = module.get<HttpService>(HttpService);
    // By default, don't return anything.
    jest.spyOn(httpService, 'post').mockImplementation(() => of(undefined));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a company', async () => {
    expect(await service.add({ name: 'Fantastic Company', country: 'CH', companyId: '456' })).toEqual({
      id: expect.any(String),
      name: 'Fantastic Company',
      created: expect.any(Date),
      country: 'CH',
      companyId: '456',
    });
  });

  it('should create many companies', async () => {
    const companyDtos = [
      { name: 'Fantastic Company', country: 'CH', companyId: '456' },
      { name: 'Mediocre Company', country: 'PL', companyId: '789' },
    ];
    const companies = companyDtos.map((dto) => {
      return {
        ...dto,
        id: expect.any(String),
        created: expect.any(Date),
      };
    });
    expect(await service.addMany(companyDtos)).toEqual(companies);
  });

  it('should update a company', async () => {
    const company1 = await service.add({ name: 'Fantastic Company' });
    service.add({ name: 'Most fantastic Company' });

    expect(await service.update(company1.id, { name: 'Awesome Company', country: 'CH', companyId: '456' })).toEqual({
      id: company1.id,
      name: 'Awesome Company',
      created: expect.any(Date),
      country: 'CH',
      companyId: '456',
    });
  });

  it('cannot update a non-existent company', async () => {
    expect(async () => {
      await service.update('non-existent-id', { name: 'Fantastic Company' });
    }).rejects.toThrowError(NotFoundException);
  });

  it('should list all companies', async () => {
    // We first need to create a few companies.
    await service.add({ name: '1' });
    await service.add({ name: '2' });
    await service.add({ name: '3' });

    expect(await service.listAll()).toEqual([
      { id: expect.any(String), name: '1', created: expect.any(Date) },
      { id: expect.any(String), name: '2', created: expect.any(Date) },
      { id: expect.any(String), name: '3', created: expect.any(Date) },
    ]);
  });

  it('should get a company by id', async () => {
    // We first need to create a few companies.
    await service.add({ name: '1' });
    const company2 = await service.add({ name: '2' });
    await service.add({ name: '3' });

    expect(await service.getById(company2.id)).toEqual({
      id: company2.id,
      name: '2',
      created: expect.any(Date),
    });
  });

  it('cannot get a non-existent company', async () => {
    expect(async () => {
      await service.getById('non-existent-id');
    }).rejects.toThrowError(NotFoundException);
  });

  it('the id must be present if we want to get by id', async () => {
    expect(async () => {
      await service.getById('');
    }).rejects.toThrowError(UnprocessableEntityException);
  });

  it('should delete a company by id', async () => {
    // We first need to create a few companies.
    await service.add({ name: '1' });
    const company2 = await service.add({ name: '2' });
    await service.add({ name: '3' });

    // Verify that the company is there.
    expect(await service.listAll()).toEqual([
      { id: expect.any(String), name: '1', created: expect.any(Date) },
      { id: expect.any(String), name: '2', created: expect.any(Date) },
      { id: expect.any(String), name: '3', created: expect.any(Date) },
    ]);

    await service.delete(company2.id);

    // Verify that the company is deleted.
    expect(await service.listAll()).toEqual([
      { id: expect.any(String), name: '1', created: expect.any(Date) },
      { id: expect.any(String), name: '3', created: expect.any(Date) },
    ]);
  });

  it('cannot delete a non-existent company', async () => {
    expect(async () => {
      await service.delete('non-existent-id');
    }).rejects.toThrowError(NotFoundException);
  });

  it('the id must be present when we want to delete by id', async () => {
    expect(async () => {
      await service.delete('');
    }).rejects.toThrowError(UnprocessableEntityException);
  });

  it('should find a company by id', async () => {
    const company = await service.add({ name: '1' });

    expect(await service.find({ id: company.id })).toEqual([
      {
        company: { id: company.id, name: '1', created: expect.any(Date) },
        confidence: expect.any(Number),
        foundBy: expect.any(String),
      },
    ]);
  });

  it('should find all companies that match a name', async () => {
    await service.add({ name: '1' });
    await service.add({ name: '1' });

    expect(await service.find({ name: '1' })).toEqual([
      {
        company: { id: expect.any(String), name: '1', created: expect.any(Date) },
        confidence: expect.any(Number),
        foundBy: expect.any(String),
      },
      {
        company: { id: expect.any(String), name: '1', created: expect.any(Date) },
        confidence: expect.any(Number),
        foundBy: expect.any(String),
      },
    ]);
  });

  it('should find a company if one individual field matches', async () => {
    await service.add({ name: '1' });

    expect(await service.find({ id: 'non-existent-id', name: '1' })).toEqual([
      {
        company: { id: expect.any(String), name: '1', created: expect.any(Date) },
        confidence: expect.any(Number),
        foundBy: expect.any(String),
      },
    ]);
  });

  it('should not contact the scaper service if there are matches in the repo', async () => {
    jest.clearAllMocks();

    await service.add({ name: '1' });

    expect(await service.find({ id: 'non-existent-id', name: '1' })).toEqual([
      {
        company: { id: expect.any(String), name: '1', created: expect.any(Date) },
        confidence: expect.any(Number),
        foundBy: expect.any(String),
      },
    ]);

    expect(httpService.post).not.toHaveBeenCalled();
  });

  it('should find companies that match individual fields, ordered by confidence', async () => {
    const company1 = await service.add({ name: '1' });
    await service.add({ name: '2' });

    expect(await service.find({ id: company1.id, name: '2' })).toEqual([
      // A match by id has higher confidence than the match by name.
      {
        company: { id: company1.id, name: '1', created: expect.any(Date) },
        confidence: expect.any(Number),
        foundBy: expect.any(String),
      },
      {
        company: { id: expect.any(String), name: '2', created: expect.any(Date) },
        confidence: expect.any(Number),
        foundBy: expect.any(String),
      },
    ]);
  });

  it('should find and deduplicate companies that match multiple individual fields', async () => {
    const company = await service.add({ name: '1' });

    expect(await service.find({ id: company.id, name: '1' })).toEqual([
      {
        company: { id: expect.any(String), name: '1', created: expect.any(Date) },
        confidence: expect.any(Number),
        foundBy: expect.any(String),
      },
    ]);
  });

  describe('when the company is not found in the first repo', () => {
    describe('and the company is found by the scraper service', () => {
      beforeEach(() => {
        const httpResponse: AxiosResponse = {
          data: [{ name: 'company found', country: 'CH', companyId: '456', confidence: 1, scraperName: 'CH' }],
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        };
        jest.spyOn(httpService, 'post').mockImplementation(() => of(httpResponse));
      });
      it('should create and find a company', async () => {
        const found = await service.find({ name: 'non-existent-name' });
        expect(found).toEqual([
          {
            company: {
              id: expect.any(String),
              name: 'company found',
              created: expect.any(Date),
              country: 'CH',
              companyId: '456',
            },
            confidence: 1,
            foundBy: 'Scraper CH',
          },
        ]);

        expect(await service.getById(found[0].company.id)).toEqual({
          id: expect.any(String),
          name: 'company found',
          created: expect.any(Date),
          country: 'CH',
          companyId: '456',
        });
      });
    });

    describe('and multiple companies are found by the scraper service', () => {
      beforeEach(() => {
        const httpResponse: AxiosResponse = {
          data: [{ name: 'company found' }, { name: 'another company found', country: 'CH', companyId: '456' }],
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        };
        jest.spyOn(httpService, 'post').mockImplementation(() => of(httpResponse));
      });
      it('should find and create all companies', async () => {
        const found = await service.find({ name: 'irrelevant' });
        expect(found).toEqual([
          { company: { id: expect.any(String), name: 'company found', created: expect.any(Date) } },
          {
            company: {
              id: expect.any(String),
              name: 'another company found',
              created: expect.any(Date),
              country: 'CH',
              companyId: '456',
            },
          },
        ]);
        expect(await service.getById(found[0].company.id)).toEqual({
          id: expect.any(String),
          name: 'company found',
          created: expect.any(Date),
        });
        expect(await service.getById(found[1].company.id)).toEqual({
          id: expect.any(String),
          name: 'another company found',
          created: expect.any(Date),
          country: 'CH',
          companyId: '456',
        });
      });

      describe('and results contain a confidence value', () => {
        beforeEach(() => {
          const httpResponse: AxiosResponse = {
            data: [
              { name: '1', confidence: 0.5 },
              { name: '2', confidence: 0.7 },
              { name: '3', confidence: 0.9 },
              { name: '4', confidence: 0.6 },
              { name: '5' },
            ],
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
          };
          jest.spyOn(httpService, 'post').mockImplementation(() => of(httpResponse));
        });
        it('results should be sorted by confidence in descending order', async () => {
          const found = await service.find({ name: 'irrelevant' });
          expect(found).toEqual([
            { company: { name: '3', id: expect.any(String), created: expect.any(Date) }, confidence: 0.9 },
            { company: { name: '2', id: expect.any(String), created: expect.any(Date) }, confidence: 0.7 },
            { company: { name: '4', id: expect.any(String), created: expect.any(Date) }, confidence: 0.6 },
            { company: { name: '1', id: expect.any(String), created: expect.any(Date) }, confidence: 0.5 },
            // Items without confidences come last.
            { company: { name: '5', id: expect.any(String), created: expect.any(Date) } },
          ]);
        });
      });
    });

    describe('and the company is not found by the scraper service', () => {
      beforeEach(() => {
        const httpResponse: AxiosResponse = {
          data: [],
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        };
        jest.spyOn(httpService, 'post').mockImplementation(() => of(httpResponse));
      });
      it('should not find a company', async () => {
        expect(await service.find({ name: 'non-existent-name' })).toEqual([]);
      });
    });

    it('should not contact the scraper service if we did not ask for any field', async () => {
      jest.clearAllMocks();
      await service.add({ name: '1' });
      await service.add({ name: '2' });
      await service.add({ name: '3' });

      expect(await service.find({})).toEqual([]);
      expect(httpService.post).not.toHaveBeenCalled();
    });
  });
});
