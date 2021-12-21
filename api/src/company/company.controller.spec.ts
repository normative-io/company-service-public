import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CompanyController } from './company.controller';
import { InMemoryCompanyService } from './inmemory.company.service';

describe('CompanyController', () => {
  let controller: CompanyController;
  let now = new Date();

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [CompanyController],
      providers: [InMemoryCompanyService],
    }).compile();

    controller = app.get<CompanyController>(CompanyController);
  });

  it('should be defined', () => {
    expect(controller.v1()).toBeDefined();
  });

  it('should create a company', () => {
    expect(controller.add({ id: '123', name: 'Fantastic Company', created: now })).toEqual({
      company: {
        id: '123',
        name: 'Fantastic Company',
        created: now,
      }
    });
  })

  it('should create a company filling the missing fields', () => {
    expect(controller.add({ name: 'Fantastic Company' })).toEqual({
      company: {
        id: expect.any(String),
        name: 'Fantastic Company',
        created: expect.any(Date),
      }
    });
  })

  it('should update a company', () => {
    controller.add({ id: '1', name: 'Fantastic Company', created: now });
    controller.add({ id: '2', name: 'Most fantastic Company', created: now });

    expect(controller.update('1', { name: 'Awesome Company' })).toEqual({
      company: {
        id: '1',
        name: 'Awesome Company',
        created: now,
      }
    });
  })

  it('cannot update a non-existent company', () => {
    expect(function () { controller.update('non-existent-id', { name: 'Fantastic Company' }); })
      .toThrowError(NotFoundException)
  })

  it('should list all companies', () => {
    // We first need to create a few companies.
    controller.add({ id: '1', name: '1', created: now });
    controller.add({ id: '2', name: '2', created: now });
    controller.add({ id: '3', name: '3', created: now });

    expect(controller.companies()).toEqual({
      companies: [
        { id: '1', name: '1', created: now },
        { id: '2', name: '2', created: now },
        { id: '3', name: '3', created: now },
      ]
    });
  })

  it('should get a company by id', () => {
    // We first need to create a few companies.
    controller.add({ id: '1', name: '1', created: now });
    controller.add({ id: '2', name: '2', created: now });
    controller.add({ id: '3', name: '3', created: now });

    expect(controller.getById('2')).toEqual({
      company: { id: '2', name: '2', created: now }
    });
  })

  it('cannot get a non-existent company', () => {
    expect(function () { controller.getById('non-existent-id'); })
      .toThrowError(NotFoundException)
  })

  it('should delete a company by id', () => {
    // We first need to create a few companies.
    controller.add({ id: '1', name: '1', created: now });
    controller.add({ id: '2', name: '2', created: now });
    controller.add({ id: '3', name: '3', created: now });

    expect(controller.companies()).toEqual({
      companies: [
        { id: '1', name: '1', created: now },
        { id: '2', name: '2', created: now },
        { id: '3', name: '3', created: now },
      ]
    });

    expect(controller.delete('2')).toEqual({ 'nr_companies': 2 });

    expect(controller.companies()).toEqual({
      companies: [
        { id: '1', name: '1', created: now },
        { id: '3', name: '3', created: now },
      ]
    });
  })

  it('cannot delete a non-existent company', () => {
    expect(function () { controller.delete('non-existent-id'); })
      .toThrowError(NotFoundException)
  })

});
