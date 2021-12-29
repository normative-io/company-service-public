import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { COMPANY_SERVICE } from './company-service.interface';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { CompanyRepositoryArray } from './repository/repository-array';
import { COMPANY_REPOSITORY } from './repository/repository-interface';
import { SCRAPER_SERVICE } from './scraper/service-interface';
import { LocalScraperService } from './scraper/service-local';

describe('CompanyController', () => {
  let controller: CompanyController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [CompanyController],
      providers: [
        {
          provide: COMPANY_SERVICE,
          useClass: CompanyService,
        },
        {
          provide: COMPANY_REPOSITORY,
          useClass: CompanyRepositoryArray,
        },
        {
          provide: SCRAPER_SERVICE,
          useClass: LocalScraperService,
        },
      ],
    }).compile();

    controller = app.get<CompanyController>(CompanyController);
  });

  it('should be defined', () => {
    expect(controller.v1()).toBeDefined();
  });

  it('should create a company', () => {
    expect(controller.add({ name: 'Fantastic Company' })).toEqual({
      company: {
        id: expect.any(String),
        name: 'Fantastic Company',
        created: expect.any(Date),
      }
    });
  })

  it('should update a company', () => {
    const company1 = controller.add({ name: 'Fantastic Company' }).company;
    controller.add({ name: 'Most fantastic Company' });

    expect(controller.update(company1.id, { name: 'Awesome Company' })).toEqual({
      company: {
        id: company1.id,
        name: 'Awesome Company',
        created: expect.any(Date),
      }
    });
  })

  it('cannot update a non-existent company', () => {
    expect(function () { controller.update('non-existent-id', { name: 'Fantastic Company' }); })
      .toThrowError(NotFoundException);
  })

  it('should list all companies', () => {
    // We first need to create a few companies.
    controller.add({ name: '1' });
    controller.add({ name: '2' });
    controller.add({ name: '3' });

    expect(controller.companies()).toEqual({
      companies: [
        { id: expect.any(String), name: '1', created: expect.any(Date) },
        { id: expect.any(String), name: '2', created: expect.any(Date) },
        { id: expect.any(String), name: '3', created: expect.any(Date) },
      ]
    });
  })

  it('should get a company by id', () => {
    // We first need to create a few companies.
    controller.add({ name: '1' });
    const company2 = controller.add({ name: '2' }).company;
    controller.add({ name: '3' });

    expect(controller.getById(company2.id)).toEqual({
      company: { id: company2.id, name: '2', created: expect.any(Date) }
    });
  })

  it('cannot get a non-existent company', () => {
    expect(function () { controller.getById('non-existent-id'); })
      .toThrowError(NotFoundException);
  })

  it('should delete a company by id', () => {
    // We first need to create a few companies.
    controller.add({ name: '1' });
    const company2 = controller.add({ name: '2' }).company;
    controller.add({ name: '3' });

    // Verify that the company is there.
    expect(controller.getById(company2.id)).toEqual({
      company: { id: company2.id, name: '2', created: expect.any(Date) }
    });

    controller.delete(company2.id);

    expect(function () { controller.getById(company2.id); })
      .toThrowError(NotFoundException);
  })

  it('cannot delete a non-existent company', () => {
    expect(function () { controller.delete('non-existent-id'); })
      .toThrowError(NotFoundException);
  })

  it('should find a company', () => {
    // We first need to create a few companies.
    controller.add({ name: '1' });
    controller.add({ name: '2' });
    controller.add({ name: '2' });

    expect(controller.find({ name: '2' })).toEqual([
      { company: { id: expect.any(String), name: '2', created: expect.any(Date) }, confidence: expect.any(Number), debugString: expect.any(String) },
      { company: { id: expect.any(String), name: '2', created: expect.any(Date) }, confidence: expect.any(Number), debugString: expect.any(String) },
    ]);
  })

});
