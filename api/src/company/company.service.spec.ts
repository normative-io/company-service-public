import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CompanyRepositoryArray } from './repository/repository-array';
import { COMPANY_REPOSITORY } from './repository/repository-interface';
import { CompanyService } from './company.service';

describe('CompanyService', () => {
    let service: CompanyService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [CompanyService,
                {
                    provide: COMPANY_REPOSITORY,
                    useClass: CompanyRepositoryArray,
                },
            ],
        }).compile();

        service = module.get<CompanyService>(CompanyService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should create a company', () => {
        expect(service.add({ name: 'Fantastic Company' })).toEqual({
            id: expect.any(String),
            name: 'Fantastic Company',
            created: expect.any(Date),
        });
    })

    it('should update a company', () => {
        const company1 = service.add({ name: 'Fantastic Company' });
        service.add({ name: 'Most fantastic Company' });

        expect(service.update(company1.id, { name: 'Awesome Company' })).toEqual({
            id: company1.id,
            name: 'Awesome Company',
            created: expect.any(Date),
        });
    })

    it('cannot update a non-existent company', () => {
        expect(function () { service.update('non-existent-id', { name: 'Fantastic Company' }); })
            .toThrowError(NotFoundException);
    })

    it('should list all companies', () => {
        // We first need to create a few companies.
        service.add({ name: '1' });
        service.add({ name: '2' });
        service.add({ name: '3' });

        expect(service.listAll()).toEqual([
            { id: expect.any(String), name: '1', created: expect.any(Date) },
            { id: expect.any(String), name: '2', created: expect.any(Date) },
            { id: expect.any(String), name: '3', created: expect.any(Date) },
        ]);
    })

    it('should get a company by id', () => {
        // We first need to create a few companies.
        service.add({ name: '1' });
        const company2 = service.add({ name: '2' });
        service.add({ name: '3' });

        expect(service.getById(company2.id)).toEqual({
            id: company2.id, name: '2', created: expect.any(Date)
        });
    })

    it('cannot get a non-existent company', () => {
        expect(function () { service.getById('non-existent-id'); })
            .toThrowError(NotFoundException);
    })

    it('the id must be present if we want to get by id', () => {
        expect(function () { service.getById(''); })
            .toThrowError(UnprocessableEntityException);
    })

    it('should delete a company by id', () => {
        // We first need to create a few companies.
        service.add({ name: '1' });
        const company2 = service.add({ name: '2' });
        service.add({ name: '3' });

        // Verify that the company is there.
        expect(service.listAll()).toEqual([
            { id: expect.any(String), name: '1', created: expect.any(Date) },
            { id: expect.any(String), name: '2', created: expect.any(Date) },
            { id: expect.any(String), name: '3', created: expect.any(Date) },
        ]);

        service.delete(company2.id);

        // Verify that the company is deleted.
        expect(service.listAll()).toEqual([
            { id: expect.any(String), name: '1', created: expect.any(Date) },
            { id: expect.any(String), name: '3', created: expect.any(Date) },
        ]);
    })

    it('cannot delete a non-existent company', () => {
        expect(function () { service.delete('non-existent-id'); })
            .toThrowError(NotFoundException);
    })

    it('the id must be present when we want to delete by id', () => {
        expect(function () { service.delete(''); })
            .toThrowError(UnprocessableEntityException);
    })

    it('should find a company by id', () => {
        const company = service.add({ name: '1' });

        expect(service.find({ id: company.id })).toEqual([
            { id: company.id, name: '1', created: expect.any(Date) },
        ]);
    })

    it('should find all companies that match a name', () => {
        service.add({ name: '1' });
        service.add({ name: '1' });

        expect(service.find({ name: '1' })).toEqual([
            { id: expect.any(String), name: '1', created: expect.any(Date) },
            { id: expect.any(String), name: '1', created: expect.any(Date) },
        ]);
    })

    it('should find a company if one individual field matches', () => {
        service.add({ name: '1' });

        expect(service.find({ id: 'non-existent-id', name: '1' })).toEqual([
            { id: expect.any(String), name: '1', created: expect.any(Date) },
        ]);
    })

    it('should find companies that match individual fields', () => {
        const company1 = service.add({ name: '1' });
        service.add({ name: '2' });

        expect(service.find({ id: company1.id, name: '2' })).toEqual([
            { id: company1.id, name: '1', created: expect.any(Date) },
            { id: expect.any(String), name: '2', created: expect.any(Date) },
        ]);
    })

    it('should find and deduplicate companies that match multiple individual fields', () => {
        const company = service.add({ name: '1' });

        expect(service.find({ id: company.id, name: '1' })).toEqual([
            { id: expect.any(String), name: '1', created: expect.any(Date) },
        ]);
    })

    it('should not find a company if nothing matches', () => {
        expect(service.find({ name: 'non-existent-name' }))
            .toEqual([]);
    })

    it('should not find a company if we do not ask for any field', () => {
        service.add({ name: '1' });
        service.add({ name: '2' });
        service.add({ name: '3' });

        expect(service.find({})).toEqual([]);
    })
});
