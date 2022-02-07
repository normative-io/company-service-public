import { Company } from '../company.model';
import { CompanyKeyDto } from '../dto/company-key.dto';
import { InsertOrUpdateDto } from '../dto/insert-or-update.dto';

export const COMPANY_REPOSITORY = 'COMPANY_REPOSITORY';

export interface ICompanyRepository {
  // Fetch the metadata of a particular company.
  // If `atTime` is set, return the metadata at that particular time.
  // If unset, return the most recent metadata for the company.
  get(country: string, companyId: string, atTime?: Date): Promise<Company | undefined>;

  // Add or update information about a particular company:
  // * If the company does not exist, inserts a new record.
  // * If the new metadata is equivalent to the most recent, updates the `lastUpdated` timestamp.
  // * If the new metadata is different from the most recent, inserts a new record.
  //
  // Previous updates will still be readable by clients using the `atTime` parameter.
  // Returns the new company record and a message describing the outcome.
  insertOrUpdate(insertOrUpdateDto: InsertOrUpdateDto): Promise<[Company, string]>;

  // Marks a company record as deleted:
  // * If the company doesn't exist, inserts a new `isDeleted` record.
  // * If the company is already marked as deleted, updates the `lastUpdated` timestamp.
  // * If the latest metadata is active, inserts a new `isDeleted` record.
  //
  // Previous updates will still be readable by clients using the `atTime` parameter.
  // To un-delete, call insertOrUpdate again with the same CompanyKey.
  // Returns the new deleted company record and a message describing the outcome.
  markDeleted(key: CompanyKeyDto): Promise<[Company, string]>;

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
