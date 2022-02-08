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
  // * If the most recent metadata is marked as deleted, inserts a record.
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

  // Returns all of the companies in the repository.
  // This should only be used for testing purposes and not exposed to external clients.
  // The production database will be too large to serve all the data in a single request.
  listAll(): Promise<Company[]>;

  save(company: Company): Promise<Company>;
  findById(id: string): Promise<Company | undefined>;
  findByName(name: string): Promise<Company[]>;
}
