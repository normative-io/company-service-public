import { ClientSession } from 'mongoose';
import { Company } from '../company.model';
import { InsertOrUpdateDto } from '../dto/insert-or-update.dto';
import { MarkDeletedDto } from '../dto/mark-deleted.dto';
import { IncomingRequest } from './mongo/incoming-request.model';

export const COMPANY_REPOSITORY = 'COMPANY_REPOSITORY';

export interface ICompanyRepository {
  // Add or update information about a particular company:
  // * If the company does not exist (no existingCompany), inserts a new record.
  // * If the new metadata is equivalent to the existing, updates the `lastUpdated` timestamp.
  // * If the new metadata is different from the existing, inserts a new record.
  //
  // Previous updates will still be readable by clients using the `atTime` parameter.
  // Returns the new company record and a message describing the outcome.
  // Must be invoked in a transaction.
  insertOrUpdate(
    insertOrUpdateDto: InsertOrUpdateDto,
    company: Company,
    existingCompany: Company | undefined,
  ): Promise<[Company, string]>;

  // Marks a company record as deleted:
  // * If the company is already marked as deleted, updates the `lastUpdated` timestamp.
  // * If the company is active, inserts a new `isDeleted` record.
  //
  // Previous updates will still be readable by clients using the `atTime` parameter.
  // To un-delete, create the company again with an `insertOrUpdate` operation.
  // Returns the new deleted company record and a message describing the outcome.
  // Must be invoked in a transaction.
  markDeleted(markDeletedDto: MarkDeletedDto, company: Company): Promise<[Company, string]>;

  // Returns all of the companies in the repository.
  // This should only be used for testing purposes and not exposed to external clients.
  // The production database will be too large to serve all the data in a single request.
  listAllForTesting(): Promise<Company[]>;

  // Returns all of the incoming requests in the repository.
  // This should only be used for testing purposes and not exposed to external clients, because:
  // (1) The production database will be too large to serve all the data in a single request.
  // (2) The fact that we store incoming requests is an internal detail; clients interact
  //     with companies.
  listAllIncomingRequestsForTesting(): Promise<IncomingRequest[]>;

  // Fetch the metadata for companies.
  // If the request's `atTime` is set, return the metadata at that particular time.
  // If unset, return the most recent metadata for each company.
  find(matchers: any[], atTime?: Date): Promise<Company[]>;

  // Start a new DB session. Use this for transactional queries.
  // To close: `session.closeSession()`.
  startSession(): Promise<ClientSession>;

  // Get the most recent data for the given company id.
  getMostRecentCompany(companyId: string): Promise<Company>;
}
