import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Company } from '../company.model';
import { ICompanyRepository } from '../repository/repository-interface';
import { InsertOrUpdateDto } from 'src/company/dto/insert-or-update.dto';
import { COMPANY_REPOSITORY } from '../repository/repository-interface';
import { SearchDto } from '../dto/search.dto';
import { CompanyFoundDto } from '../dto/company-found.dto';
import { MarkDeletedDto } from '../dto/mark-deleted.dto';
import { IncomingRequest } from '../repository/mongo/incoming-request.model';

// This service contains the business logic to interface with the repository.

@Injectable()
export class RepoService {
  private readonly logger = new Logger(RepoService.name);

  // These confidence values have been chosen intuitively.
  static readonly confidenceByCompanyIdAndCountry = 0.9;
  static readonly confidenceByTaxId = 0.9;
  static readonly confidenceByOrgNbr = 0.8;
  static readonly confidenceByName = 0.7;

  constructor(
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepo: ICompanyRepository,
  ) {}

  async listAllForTesting(): Promise<Company[]> {
    return await this.companyRepo.listAllForTesting();
  }

  async listAllIncomingRequestsForTesting(): Promise<IncomingRequest[]> {
    return await this.companyRepo.listAllIncomingRequestsForTesting();
  }

  async countCompanies(searchDto: SearchDto): Promise<Number> {
    return (await this.companyRepo.find([searchDto], searchDto.atTime)).length;
  }

  private async findByIndividualIds(ids: any[]): Promise<Company[]> {
    const found: Company[] = [];
    for (const id of ids) {
      found.push(...(await this.companyRepo.find([id])));
    }

    // Dedup by companyId.
    return found.filter(
      (elem, index, self) =>
        // Keep if this is the first index for this company's companyId.
        index === self.findIndex((c) => c.companyId === elem.companyId),
    );
  }

  private async findExistingCompany(insertOrUpdateDto: InsertOrUpdateDto, ids: any[]): Promise<Company | undefined> {
    const prettyRequest = `${JSON.stringify(insertOrUpdateDto)}`;
    const existing = await this.companyRepo.find(ids);
    this.logger.log(`Existing companies that match insertOrUpdateDto ${prettyRequest}: ${JSON.stringify(existing)}`);

    if (existing.length > 1) {
      const message = `Multiple companies match the identifiers in ${prettyRequest}`;
      this.logger.error(message);
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
    if (existing.length === 1) {
      return existing[0];
    }

    if (existing.length === 0 && ids.length > 1) {
      // We're in line 11 of the algorithm mentioned in the method comment of `insertOrUpdate()`:
      // no existing companies mach *all* identifiers at once, but maybe some
      // match individual identifiers.
      // Inside this `if`, we detect whether we're in error case (c) (we find multiple companies
      // when we search by individual identifiers).

      const byIndividualId = await this.findByIndividualIds(ids);
      if (byIndividualId.length > 1) {
        const message = `Multiple companies match the identifiers ${JSON.stringify(ids)}`;
        this.logger.error(`${message}: ${JSON.stringify(byIndividualId)}`);
        throw new HttpException(message, HttpStatus.BAD_REQUEST);
      }

      // If there's just one company that matches individual identifiers, that becomes
      // our existingCompany.
      if (byIndividualId.length === 1) {
        const onlyMatch = byIndividualId[0];
        this.logger.log(`Found a single company that matches individual identifiers: ${JSON.stringify(onlyMatch)}`);
        return onlyMatch;
      }
    }
    return;
  }

  // An insertOrUpdate operation can have the following three outcomes:
  // INSERT: Insert a new record and a new company
  // UPDATE: Insert a new record and update an existing company with data from the new record
  // ERROR: This operation would cause an inconsistency in the data
  //
  // Logic:
  //
  // 1  (A) Fail if no identifier is present in the request
  // 2  (B) If there is only one identifier in the request:
  // 3    Get all companies that match that identifier
  // 4      If there is just one company: UPDATE
  // 5      If no companies: INSERT
  // 6      If more than one company (although we should never get here if we follow this logic): ERROR
  // 7  (C) If there is more than one identifier in the request:
  // 8    Get all companies that match all identifiers
  // 9      If more than one company (although we should never get here if we follow this logic): ERROR
  // 10     If only one company: UPDATE
  // 11     If no companies:
  // 12       // It could be that:
  // 13       // (a) the new record is truly a new company, or that
  // 14       // (b) it is trying to add one or more identifiers to a company for which we had a
  // 15       //     different type of identifier, or that
  // 16       // (c) it mistakenly contains identifiers from multiple companies, or that
  // 17       // (d) it is trying to update an identifier (which we don’t allow).
  // 18       // We need to distinguish which case it is.
  // 19       Search by each identifier separately.
  // 20         If no identifiers give us any companies: INSERT
  // 21         If two or more identifiers give us different companies: ERROR
  // 22         If all searches that return results give us the same company:
  // 23           If the company does not contain any of the identifiers that did not return results: UPDATE
  // 24           Otherwise (the request is trying to update an identifier): ERROR
  //
  // ############################ GOTCHAS ############################
  //
  // ---------------------- Data Inconsistencies ---------------------
  //
  // Inconsistencies in the data are caused by conflicting identifiers.
  // Companies have local and global identifiers that define them (see the `identifiers()`
  // method).
  // Global identifiers, and combinations of (country + local identifier), are unique.
  // Two companies cannot share the same values for these fields.
  // The `insertOrUpdate` operation does not allow inserting data that
  // modifies present identifiers (but it is possible to add identifiers that
  // were empty previously), or that sets identifiers from a different company.
  // When this happens, the data in the repository needs to be resolved before the
  // operation can succeed.
  //
  // -------------------------- Data Quality -------------------------
  //
  // Data can be inserted in the repository by on-demand scrapers, by batch scrapers,
  // or manually through the Company Service API.
  // The Company Service does not provide explicit quality assurance for the data that
  // is added or is in the repository. A new valid request to insert or update data will
  // always override any previous data for a company, even if the new data could be of
  // lower quality (e.g., missing fields that were set in a previous version).
  //
  // The reason why the application has been set up like this is because it is not
  // easy to come up with a universal algorithm to decide how good some data is, or
  // when the new data we are trying to add is better than the existing data, or how to
  // merge the new data with the existing one.
  // It is up to the application owner to review the data that is being added to the
  // repository. The Company Service provides some basic information to help with this:
  //
  // - All requests to insert or update data are recorded in the repository.
  // - Companies in the repository have a `dataSource` field that contains who added the
  //   data - this could be used to decide how reliable the data in the repository is.
  //
  async insertOrUpdate(insertOrUpdateDto: InsertOrUpdateDto): Promise<[Company, string]> {
    const prettyRequest = `${JSON.stringify(insertOrUpdateDto)}`;

    const [ids, info] = identifiers(insertOrUpdateDto);
    if (ids.length === 0) {
      const message = `Invalid insertOrUpdate request ${prettyRequest}, not enough identifiers: ${info}`;
      this.logger.error(message);
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(`Ids in ${prettyRequest}: ${JSON.stringify(ids)}`);

    // Operation is performed in a transaction to avoid race conditions
    // between checking the most recent record and inserting a new one.
    const session = await this.companyRepo.startSession();
    let company: Company;
    let msg: string;

    await session.withTransaction(async () => {
      const existingCompany = await this.findExistingCompany(insertOrUpdateDto, ids);
      const newCompanyId = existingCompany ? existingCompany.companyId : Company.newCompanyId();
      const newCompany = new Company(insertOrUpdateDto, newCompanyId);

      if (existingCompany) {
        this.logger.debug(`Found existing company for ${prettyRequest}: ${JSON.stringify(newCompany)}`);
        const [isSame, reason] = newCompany.isSameEntity(existingCompany);
        if (!isSame) {
          const message = `Cannot add record ${JSON.stringify(newCompany)} for existing company ${JSON.stringify(
            existingCompany,
          )}: ${reason}`;
          this.logger.error(message);
          throw new HttpException(message, HttpStatus.BAD_REQUEST);
        }
      }

      [company, msg] = await this.companyRepo.insertOrUpdate(insertOrUpdateDto, newCompany, existingCompany);
    });
    session.endSession();
    this.logger.debug(msg);
    return [company, msg];
  }

  async markDeleted(markDeletedDto: MarkDeletedDto): Promise<[Company, string]> {
    const session = await this.companyRepo.startSession();
    let company: Company;
    let msg: string;
    await session.withTransaction(async () => {
      const mostRecent = await this.companyRepo.getMostRecentCompany(markDeletedDto.companyId);
      const prettyRequest = `${JSON.stringify(markDeletedDto)}`;

      this.logger.debug(`MarkDelete request ${prettyRequest} found most recent: ${JSON.stringify(mostRecent)}`);

      if (!mostRecent) {
        const message = `Cannot find company to delete, unknown company: ${prettyRequest}`;
        this.logger.error(message);
        throw new HttpException(message, HttpStatus.BAD_REQUEST);
      }
      [company, msg] = await this.companyRepo.markDeleted(markDeletedDto, mostRecent);
    });
    session.endSession();
    this.logger.debug(msg);
    return [company, msg];
  }

  private async findAndAdd(
    results: CompanyFoundDto[],
    matcher: any,
    confidence: number,
    foundBy: string,
    atTime?: Date,
  ) {
    results.push(
      ...(await this.companyRepo.find([matcher], atTime)).map(function (company) {
        return { confidence, foundBy, company };
      }),
    );
  }

  // find searches for a company in the database.
  // The search is based on the following fields:
  // 1. TaxId
  // 2. OrgNbr + country
  // 3. Name
  // The search is performed by all applicable fields, i.e., if a request
  // contains both TaxId and Name, both searches will be performed, and
  // all results are concatenated in the final return value.
  // Callers should not assume that results are ordered by CompanyFoundDto.confidence.
  async find(searchDto: SearchDto): Promise<CompanyFoundDto[]> {
    const results: CompanyFoundDto[] = [];
    if (searchDto.taxId) {
      await this.findAndAdd(
        results,
        { taxId: searchDto.taxId },
        RepoService.confidenceByTaxId,
        'Repository by taxId',
        searchDto.atTime,
      );
    }
    if (searchDto.orgNbr && searchDto.country) {
      await this.findAndAdd(
        results,
        { orgNbr: searchDto.orgNbr, country: searchDto.country },
        RepoService.confidenceByOrgNbr,
        'Repository by orgNbr and country',
        searchDto.atTime,
      );
    }
    if (searchDto.companyName) {
      await this.findAndAdd(
        results,
        { companyName: searchDto.companyName },
        RepoService.confidenceByName,
        'Repository by name',
        searchDto.atTime,
      );
    }
    return results;
  }
}

function identifiers(insertOrUpdateDto: InsertOrUpdateDto): [any[], string] {
  const ids: any[] = [];
  if (insertOrUpdateDto.taxId) {
    ids.push({ taxId: insertOrUpdateDto.taxId });
  }
  if (insertOrUpdateDto.orgNbr && insertOrUpdateDto.country) {
    ids.push({ orgNbr: insertOrUpdateDto.orgNbr, country: insertOrUpdateDto.country });
  }
  return [ids, 'identifiers checked: [taxId, orgNbr+country]'];
}
