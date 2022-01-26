import { Company } from '../company.model';

export const COMPANY_REPOSITORY = 'COMPANY_REPOSITORY';

export interface ICompanyRepository {
  exists(company: Company): Promise<boolean>;
  save(company: Company): Promise<Company>;
  listAll(): Promise<Company[]>;
  // Find a company or throw NotFoundException
  getById(id: string): Promise<Company>;
  // Delete a company identified by id
  delete(id: string): void;
  findById(id: string): Promise<Company | undefined>;
  findByName(name: string): Promise<Company[]>;
  findByCompanyIdAndCountry(companyId: string, country: string): Promise<Company | undefined>;
}
