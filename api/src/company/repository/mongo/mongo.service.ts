import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Company } from '../../company.model';
import { ICompanyRepository } from '../repository-interface';
import { Model } from 'mongoose';
import { CompanyDbObject, CompanyDocument } from './company.schema';
import { IncomingRequestDbObject, IncomingRequestDocument } from './incoming-request.schema';
import { InsertOrUpdateDto } from 'src/company/dto/insert-or-update.dto';
import { IncomingRequest, RequestType } from './incoming-request.model';
import { SearchDto } from 'src/company/dto/search.dto';
import { MarkDeletedDto } from 'src/company/dto/mark-deleted.dto';
import { CompanyFoundDto } from 'src/company/dto/company-found.dto';

// A MongoDB-based repository for storing company data.
@Injectable()
export class MongoRepositoryService implements ICompanyRepository {
  // TODO: Some methods throw HttpExceptions, which is ugly for a DB Service, can we do better?

  logger = new Logger(MongoRepositoryService.name);

  // These confidence values have been chosen intuitively.
  static readonly confidenceByCompanyIdAndCountry = 0.9;
  static readonly confidenceByTaxId = 0.9;
  static readonly confidenceByName = 0.7;

  constructor(
    @InjectModel(CompanyDbObject.name) private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(IncomingRequestDbObject.name) private readonly incomingRequestModel: Model<IncomingRequestDocument>,
  ) {}

  // Fetch the metadata of a particular company.
  // If `atTime` is set, return the metadata at that particular time.
  // If unset, return the most recent metadata for the company.
  // Metadata marked as deleted is not returned.
  private async get(companyId: string, atTime?: Date): Promise<Company | undefined> {
    if (!atTime) {
      const mostRecent = await this.getMostRecentRecord(companyId);
      if (!mostRecent || mostRecent.isDeleted) {
        return; // Deleted records should not be returned.
      }
      return companyDbObjectToModel(mostRecent);
    }
    const dbObjects = await this.companyModel.find({ companyId }).sort('-created');
    // The first item in this descending-creation-time-ordered
    // list that was created before `atTime` is the record
    // that was active during the requested `atTime`.
    for (const dbObject of dbObjects) {
      if (dbObject.created <= atTime) {
        if (dbObject.isDeleted) {
          return; // Deleted records should not be returned.
        }
        return companyDbObjectToModel(dbObject);
      }
    }
  }

  // Fetch the most recent metadata of a particular company, even if it is deleted.
  // See `get` to skip deleted records.
  private async getMostRecentRecord(companyId: string): Promise<CompanyDbObject> {
    return await this.companyModel.findOne({ companyId }).sort('-created');
  }

  private static identifiers(insertOrUpdateDto: InsertOrUpdateDto): [any[], string] {
    const ids: any[] = [];
    if (insertOrUpdateDto.taxId) {
      ids.push({ taxId: insertOrUpdateDto.taxId });
    }
    if (insertOrUpdateDto.orgNbr && insertOrUpdateDto.country) {
      ids.push({ orgNbr: insertOrUpdateDto.orgNbr, country: insertOrUpdateDto.country });
    }
    return [ids, 'identifiers checked: [taxId, orgNbr+country]'];
  }

  private async findByIndividualIds(ids: any[]): Promise<Company[]> {
    const found: Company[] = [];
    for (const id of ids) {
      found.push(...(await this.findByMatcher([id])));
    }

    // Dedup by companyId.
    return found.filter(
      (elem, index, self) =>
        // Keep if this is the first index for this company's companyId.
        index === self.findIndex((c) => c.companyId === elem.companyId),
    );
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
  async insertOrUpdate(insertOrUpdateDto: InsertOrUpdateDto): Promise<[Company, string]> {
    const prettyRequest = `${JSON.stringify(insertOrUpdateDto)}`;

    const [ids, info] = MongoRepositoryService.identifiers(insertOrUpdateDto);
    if (ids.length === 0) {
      const message = `Invalid insertOrUpdate request ${prettyRequest}, not enough identifiers: ${info}`;
      this.logger.error(message);
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(`Ids in ${prettyRequest}: ${JSON.stringify(ids)}`);

    // Operation is performed in a transaction to avoid race conditions
    // between checking the most recent record and inserting a new one.
    const session = await this.companyModel.startSession();
    let companyDbObject: CompanyDbObject;
    let msg: string;

    await session.withTransaction(async () => {
      this.incomingRequestModel.create(insertOrUpdateDtoToDbObject(insertOrUpdateDto));
      const existingCompanies = await this.findByMatcher(ids);
      this.logger.log(
        `Existing companies that match insertOrUpdateDto ${prettyRequest}: ${JSON.stringify(existingCompanies)}`,
      );
      if (existingCompanies.length > 1) {
        const message = `Multiple companies match the identifiers in ${prettyRequest}`;
        this.logger.error(message);
        throw new HttpException(message, HttpStatus.BAD_REQUEST);
      }

      // The existing company this new record should belong to, if any.
      let existingCompany: Company;
      if (existingCompanies.length === 1) {
        existingCompany = existingCompanies[0];
      }

      if (existingCompanies.length === 0 && ids.length > 1) {
        // We're in line 11 of the algorithm detailed in this method's comment:
        // no existing companies mach *all* identifiers at once, but maybe some
        // match individual identifiers.
        // Inside this `if`, we detect whether we're in error case (c) (we find multiple companies
        // when we search by individual identifiers), and let the code later handle the other error cases.

        const byIndividualId = await this.findByIndividualIds(ids);
        if (byIndividualId.length > 1) {
          const message = `Multiple companies match the identifiers in ${prettyRequest}`;
          this.logger.error(`${message}: ${JSON.stringify(byIndividualId)}`);
          throw new HttpException(message, HttpStatus.BAD_REQUEST);
        }

        // If there's just one company that matches individual identifiers, that becomes
        // our existingCompany.
        if (byIndividualId.length === 1) {
          const onlyMatch = byIndividualId[0];
          this.logger.log(`Found a single company that matches individual identifiers: ${JSON.stringify(onlyMatch)}`);
          existingCompany = onlyMatch;
        }
      }
      [companyDbObject, msg] = await this.doInsertOrUpdate(insertOrUpdateDto, existingCompany);
    });
    session.endSession();
    this.logger.debug(msg);
    return [companyDbObjectToModel(companyDbObject), msg];
  }

  private async doInsertOrUpdate(
    dto: InsertOrUpdateDto,
    existingCompany: Company | undefined,
  ): Promise<[CompanyDbObject, string]> {
    const prettyRequest = `${JSON.stringify(dto)}`;

    if (!existingCompany) {
      const newCompany = new Company(dto, Company.newCompanyId());

      const companyDbObject = await this.companyModel.create(companyModelToDbObject(newCompany));
      const msg = `Inserted an initial record for company: ${JSON.stringify(newCompany)}`;
      return [companyDbObject, msg];
    }

    const newCompany = new Company(dto, existingCompany.companyId);
    const prettyNewCompany = `${JSON.stringify(newCompany)}`;

    this.logger.debug(`Found existing company for ${prettyRequest}: ${prettyNewCompany}`);

    if (newCompany.isMetadataEqual(existingCompany)) {
      return [
        await this.companyModel.findByIdAndUpdate(
          existingCompany.id,
          { lastUpdated: new Date() },
          { returnDocument: 'after' },
        ),
        `Marked as up-to-date; metadata is equal to the most recent record: ${prettyRequest}`,
      ];
    }

    const [isSame, reason] = newCompany.isSameEntity(existingCompany);
    if (!isSame) {
      const message = `Cannot add record ${prettyNewCompany} for existing company ${JSON.stringify(
        existingCompany,
      )}: ${reason}`;
      this.logger.error(message);
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }

    return [
      await this.companyModel.create(companyModelToDbObject(newCompany)),
      `Updated metadata for company: ${prettyNewCompany}`,
    ];
  }

  async markDeleted(markDeletedDto: MarkDeletedDto): Promise<[Company, string]> {
    const session = await this.companyModel.startSession();
    let dbObject: CompanyDbObject;
    let msg: string;
    await session.withTransaction(async () => {
      this.incomingRequestModel.create(markDeletedDtoToDbObject(markDeletedDto));
      const mostRecent = await this.getMostRecentRecord(markDeletedDto.companyId);
      const prettyRequest = `${JSON.stringify(markDeletedDto)}`;

      this.logger.debug(`MarkDelete request ${prettyRequest} found most recent: ${JSON.stringify(mostRecent)}`);

      if (!mostRecent) {
        const message = `Cannot find company to delete, unknown company: ${prettyRequest}`;
        this.logger.error(message);
        throw new HttpException(message, HttpStatus.BAD_REQUEST);
      }
      [dbObject, msg] = await this.doMarkDeleted(markDeletedDto, mostRecent);
    });
    session.endSession();
    this.logger.debug(msg);
    return [companyDbObjectToModel(dbObject), msg];
  }

  private async doMarkDeleted(dto: MarkDeletedDto, mostRecent: CompanyDbObject): Promise<[CompanyDbObject, string]> {
    const prettyRequest = `${JSON.stringify(dto)}`;
    if (!mostRecent.isDeleted) {
      // The data we create the company with doesn't really matter, as long as
      // we set `isDeleted` and the companyId. We add the country because it's
      // required in the dto.
      const deletedCompany = new Company({ country: mostRecent.country }, mostRecent.companyId);
      deletedCompany.isDeleted = true;
      return [
        await this.companyModel.create(companyModelToDbObject(deletedCompany)),
        `Marked as deleted: ${prettyRequest}`,
      ];
    }
    return [
      await this.companyModel.findByIdAndUpdate(
        mostRecent._id,
        { lastUpdated: new Date() },
        { returnDocument: 'after' },
      ),
      `Marked as up-to-date; company already marked as deleted: ${prettyRequest}`,
    ];
  }

  async listAllForTesting(): Promise<Company[]> {
    const companies: Company[] = [];
    for (const dbObject of await this.companyModel.find()) {
      companies.push(companyDbObjectToModel(dbObject));
    }
    return [...companies];
  }

  async listAllIncomingRequestsForTesting(): Promise<IncomingRequest[]> {
    const requests: IncomingRequest[] = [];
    for (const dbObject of await this.incomingRequestModel.find()) {
      requests.push(incomingRequestDbObjectToModel(dbObject));
    }
    return [...requests];
  }

  // find searches for a company in the database.
  // The search is based on the following fields:
  // 1. TaxId
  // 2. Name
  // The search is performed by all applicable fields, i.e., if a request
  // contains both TaxId and Name, both searches will be performed, and
  // all results are concatenated in the final return value.
  // Callers should not assume that results are ordered by CompanyFoundDto.confidence.
  async find(searchDto: SearchDto): Promise<CompanyFoundDto[]> {
    const results: CompanyFoundDto[] = [];
    // TODO: Is taxId a global or a local identifier? If local, add the `country`.
    if (searchDto.taxId) {
      results.push(
        ...(await this.findByMatcher([{ taxId: searchDto.taxId }], searchDto.atTime)).map(function (company) {
          return {
            confidence: MongoRepositoryService.confidenceByTaxId,
            foundBy: 'Repository by taxId',
            company: company,
          };
        }),
      );
    }
    if (searchDto.companyName) {
      results.push(
        ...(await this.findByMatcher([{ companyName: searchDto.companyName }], searchDto.atTime)).map(function (
          company,
        ) {
          return {
            confidence: MongoRepositoryService.confidenceByName,
            foundBy: 'Repository by name',
            company: company,
          };
        }),
      );
    }
    return results;
  }

  // findByMatcher finds companies that match the given argument.
  // If `atTime` unset, return the most recent matching metadata for the company.
  // If `atTime` is set, return the metadata at that particular time.
  private async findByMatcher(matchers: any[], atTime?: Date): Promise<Company[]> {
    let matcher: any = {};
    for (const m of matchers) {
      matcher = { ...matcher, ...m };
    }

    const companies: Company[] = [];
    for (const dbObject of await this.companyModel.find(matcher)) {
      const recordAtTime = await this.get(dbObject.companyId, atTime);

      // Duplicates can occur if a company has multiple records that match the previous `find`
      // operation, because the state of the company at a given time (which is what `get`
      // returns) will be the same for all of those records.
      if (recordAtTime && companies.findIndex((c) => c.id === recordAtTime.id) === -1) {
        companies.push(recordAtTime);
      }
    }
    return [...companies];
  }
}

function insertOrUpdateDtoToDbObject(insertOrUpdate: InsertOrUpdateDto): IncomingRequestDbObject {
  if (!insertOrUpdate) {
    return;
  }
  return {
    country: insertOrUpdate.country,
    companyName: insertOrUpdate.companyName,
    dataSource: insertOrUpdate.dataSource,
    isic: insertOrUpdate.isic,
    created: new Date(),
    requestType: RequestType.InsertOrUpdate,
    taxId: insertOrUpdate.taxId,
    orgNbr: insertOrUpdate.orgNbr,
  };
}

function markDeletedDtoToDbObject(markDeletedDto: MarkDeletedDto): IncomingRequestDbObject {
  if (!markDeletedDto) {
    return;
  }
  return {
    companyId: markDeletedDto.companyId,
    created: new Date(),
    requestType: RequestType.MarkDeleted,
  };
}

function companyModelToDbObject(company: Company): CompanyDbObject {
  if (!company) {
    return;
  }
  return {
    _id: company.id,
    companyId: company.companyId,
    country: company.country,
    companyName: company.companyName,
    isic: company.isic,
    created: company.created,
    lastUpdated: company.lastUpdated,
    dataSource: company.dataSource,
    isDeleted: company.isDeleted,
    taxId: company.taxId,
    orgNbr: company.orgNbr,
  };
}

function incomingRequestDbObjectToModel(dbObject: IncomingRequestDbObject): IncomingRequest {
  if (!dbObject) {
    return;
  }

  return {
    requestType: <RequestType>dbObject.requestType,
    created: dbObject.created,
    companyId: dbObject.companyId,
    country: dbObject.country,
    companyName: dbObject.companyName,
    isic: dbObject.isic,
    dataSource: dbObject.dataSource,
    taxId: dbObject.taxId,
    orgNbr: dbObject.orgNbr,
  };
}

function companyDbObjectToModel(dbObject: CompanyDbObject): Company {
  if (!dbObject) {
    return;
  }
  const company = new Company(
    {
      country: dbObject.country,
      companyName: dbObject.companyName,
      isic: dbObject.isic,
      dataSource: dbObject.dataSource,
      taxId: dbObject.taxId,
      orgNbr: dbObject.orgNbr,
    },
    dbObject.companyId,
  );
  company.id = dbObject._id;
  company.created = dbObject.created;
  company.lastUpdated = dbObject.lastUpdated;
  // The code assumes that `company.isDeleted` is only populated if it is true,
  // and equality checks would fail if we put a value of `false`.
  if (dbObject.isDeleted) {
    company.isDeleted = true;
  }
  return company;
}
