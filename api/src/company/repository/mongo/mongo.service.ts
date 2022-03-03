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

  // Find companies that match all identifiers of an `insertOrUpdate` request.
  private async findCompaniesByAllIdentifiers(insertOrUpdateDto: InsertOrUpdateDto): Promise<Company[]> {
    const results: Company[] = [];
    if (insertOrUpdateDto.taxId) {
      results.push(...(await this.findByMatcher({ taxId: insertOrUpdateDto.taxId })));
    }
    return results;
  }

  // An insertOrUpdate operation can have the following three outcomes:
  // INSERT: Insert a new record and a new company
  // UPDATE: Insert a new record and update an existing company with data from the new record
  // ERROR: This operation would cause an inconsistency in the data
  //
  // Logic:
  //
  // (A) [TODO] Fail if no identifier is present in the request
  // (B) If there is only one identifier in the request:
  //   Get all companies that match that identifier
  //     If there is just one company: UPDATE
  //     If no companies: INSERT
  //     If more than one company (although we should never get here if we follow this logic): ERROR
  // (C) [TODO] If there is more than one identifier in the request:
  //   Get all companies that match all identifiers
  //     If more than one company (although we should never get here if we follow this logic): ERROR
  //     If only one company: UPDATE
  //     If no companies:
  //       // It could be that:
  //       // (a) the new record is truly a new company, or that
  //       // (b) it is trying to add one or more identifiers to a company for which we had a
  //       //     different type of identifier, or that
  //       // (c) it mistakenly contains identifiers from multiple companies, or that
  //       // (d) it is trying to update an identifier (which we don’t allow).
  //       // We need to distinguish which case it is.
  //       Search by each identifier separately.
  //         If no identifiers give us any companies: INSERT
  //         If two or more identifiers give us different companies: ERROR
  //         If all searches that return results give us the same company:
  //           If the company does not contain any of the identifiers that did not return results: UPDATE
  //           Otherwise (the request is trying to update an identifier): ERROR
  async insertOrUpdate(insertOrUpdateDto: InsertOrUpdateDto): Promise<[Company, string]> {
    // Operation is performed in a transaction to avoid race conditions
    // between checking the most recent record and inserting a new one.
    const session = await this.companyModel.startSession();
    let companyDbObject: CompanyDbObject;
    let msg: string;
    const prettyRequest = `${JSON.stringify(insertOrUpdateDto)}`;

    await session.withTransaction(async () => {
      this.incomingRequestModel.create(insertOrUpdateDtoToDbObject(insertOrUpdateDto));
      const existingCompanies = await this.findCompaniesByAllIdentifiers(insertOrUpdateDto);
      this.logger.log(
        `Existing companies that match insertOrUpdateDto ${prettyRequest}: ${JSON.stringify(existingCompanies)}`,
      );
      if (existingCompanies.length > 1) {
        const message = `Multiple companies match the identifiers in ${prettyRequest}`;
        this.logger.error(message);
        // TODO: Is there a better easy way of raising a problem, than throwing an HttpException?
        throw new HttpException(message, HttpStatus.BAD_REQUEST);
      }
      [companyDbObject, msg] = await this.doInsertOrUpdate(insertOrUpdateDto, existingCompanies);
    });
    session.endSession();
    this.logger.debug(msg);
    return [companyDbObjectToModel(companyDbObject), msg];
  }

  private async doInsertOrUpdate(
    dto: InsertOrUpdateDto,
    existingCompanies: Company[],
  ): Promise<[CompanyDbObject, string]> {
    const prettyRequest = `${JSON.stringify(dto)}`;

    if (existingCompanies.length === 0) {
      const newCompany = new Company(dto, Company.newCompanyId());

      const companyDbObject = await this.companyModel.create(companyModelToDbObject(newCompany));
      const msg = `Inserted an initial record for company: ${JSON.stringify(newCompany)}`;
      return [companyDbObject, msg];
    }

    const existingCompany = existingCompanies[0];
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

    return [
      // TODO: Merge newCompany and existingCompany, instead of blindly adding a new record
      // with the latest insertOrUpdate information only. The data in the database might be better
      // or more complete.
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
        // TODO: It is a bit ugly that a DB Service throws HttpExceptions, can we do better?
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
        ...(await this.findByMatcher({ taxId: searchDto.taxId }, searchDto.atTime)).map(function (company) {
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
        ...(await this.findByMatcher({ companyName: searchDto.companyName }, searchDto.atTime)).map(function (company) {
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
  private async findByMatcher(matcher: any, atTime?: Date): Promise<Company[]> {
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
