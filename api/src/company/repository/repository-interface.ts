import { Company } from '../company.model';

export const COMPANY_REPOSITORY = 'COMPANY_REPOSITORY';

export interface ICompanyRepository {
  exists(company: Company): boolean;
  save(company: Company): Company;
  listAll(): Company[];
  // Find a company or throw NotFoundException
  getById(id: string): Company;
  // Delete a company identified by id
  delete(id: string);
  findById(id: string): Company | undefined;
  findByName(name: string): Company[];
  findByCompanyIdAndCountry(companyId: string, country: string): Company | undefined;
}
