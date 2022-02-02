import { Company } from '../company.model';

export const COMPANY_REPOSITORY = 'COMPANY_REPOSITORY';

export interface ICompanyRepository {
  // Fetch the metadata of a particular company.
  // If `atTime` is set, return the metadata at that particular time.
  // If unset, return the most recent metadata for the company.
  get(country: string, companyId: string, atTime?: Date): Promise<Company | undefined>;
  exists(company: Company): Promise<boolean>;
  save(company: Company): Promise<Company>;
  listAll(): Promise<Company[]>;
  // Find a company or throw NotFoundException
  getById(id: string): Promise<Company>;
  // Delete a company identified by id
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Company | undefined>;
  findByName(name: string): Promise<Company[]>;
  findByCompanyIdAndCountry(companyId: string, country: string): Promise<Company | undefined>;
}
