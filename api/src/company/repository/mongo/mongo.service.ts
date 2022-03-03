import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Company } from '../../company.model';
import { ICompanyRepository } from '../repository-interface';
import { Model } from 'mongoose';
import { CompanyDbObject, CompanyDocument } from './company.schema';
import { IncomingRequestDbObject, IncomingRequestDocument } from './incoming-request.schema';
import { InsertOrUpdateDto } from 'src/company/dto/insert-or-update.dto';
import { CompanyKeyDto } from 'src/company/dto/company-key.dto';
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
  static readonly confidenceByName = 0.7;

  constructor(
    @InjectModel(CompanyDbObject.name) private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(IncomingRequestDbObject.name) private readonly incomingRequestModel: Model<IncomingRequestDocument>,
  ) {}

  // Fetch the metadata of a particular company.
  // If `atTime` is set, return the metadata at that particular time.
  // If unset, return the most recent metadata for the company.
  private async get(country: string, companyId: string, atTime?: Date): Promise<Company | undefined> {
    if (!atTime) {
      const mostRecent = await this.getMostRecentRecord({ country, companyId });
      if (!mostRecent || mostRecent.isDeleted) {
        return; // Deleted records should not be returned.
      }
      return companyDbObjectToModel(mostRecent);
    }
    const dbObjects = await this.companyModel.find({ country, companyId }).sort('-created');
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

  async insertOrUpdate(insertOrUpdateDto: InsertOrUpdateDto): Promise<[Company, string]> {
    // Operation is performed in a transaction to avoid race conditions
    // between checking the most recent record and inserting a new one.
    const session = await this.companyModel.startSession();
    let companyDbObject: CompanyDbObject;
    let msg: string;
    await session.withTransaction(async () => {
      this.incomingRequestModel.create(insertOrUpdateDtoToDbObject(insertOrUpdateDto));
      const newCompany = new Company(insertOrUpdateDto);
      const mostRecent = companyDbObjectToModel(await this.getMostRecentRecord(insertOrUpdateDto));
      if (newCompany.isMetadataEqual(mostRecent)) {
        companyDbObject = await this.companyModel.findByIdAndUpdate(
          mostRecent.id,
          { lastUpdated: new Date() },
          { returnDocument: 'after' },
        );
        msg = `Marked as up-to-date; metadata is equal to the most recent record: ${JSON.stringify(insertOrUpdateDto)}`;
      } else {
        companyDbObject = await this.companyModel.create(companyModelToDbObject(newCompany));
        if (mostRecent) {
          msg = `Updated metadata for company: ${JSON.stringify(insertOrUpdateDto)}`;
        } else {
          msg = `Inserted an initial record for company: ${JSON.stringify(insertOrUpdateDto)}`;
        }
      }
    });
    session.endSession();
    this.logger.debug(msg);
    return [companyDbObjectToModel(companyDbObject), msg];
  }

  async markDeleted(markDeletedDto: MarkDeletedDto): Promise<[Company, string]> {
    const session = await this.companyModel.startSession();
    let dbObject: CompanyDbObject;
    let msg: string;
    await session.withTransaction(async () => {
      this.incomingRequestModel.create(markDeletedDtoToDbObject(markDeletedDto));
      const mostRecent = await this.getMostRecentRecord(markDeletedDto);
      if (!mostRecent || !mostRecent.isDeleted) {
        const deleteRecord = new Company({ country: markDeletedDto.country, companyId: markDeletedDto.companyId });
        deleteRecord.isDeleted = true;
        dbObject = await this.companyModel.create(companyModelToDbObject(deleteRecord));
        msg = `Marked as deleted: ${JSON.stringify(markDeletedDto)}`;
      } else {
        dbObject = await this.companyModel.findByIdAndUpdate(
          mostRecent._id,
          { lastUpdated: new Date() },
          { returnDocument: 'after' },
        );
        msg = `Marked as up-to-date; company already marked as deleted: ${JSON.stringify(markDeletedDto)}`;
      }
    });
    session.endSession();
    this.logger.debug(msg);
    return [companyDbObjectToModel(dbObject), msg];
  }

  private async getMostRecentRecord(key: CompanyKeyDto): Promise<CompanyDbObject> {
    return await this.companyModel.findOne({ country: key.country, companyId: key.companyId }).sort('-created');
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

  // find searches for a company in the repo.
  // The search is based on the following fields:
  // 1. Country and CompanyId
  // 2. Name
  // The search is performed by all applicable fields, i.e., if a request
  // contains both CompanyId and Name, both searches will be performed, and
  // all results are concatenated in the final return value.
  // Callers should not assume that results are ordered by CompanyFoundDto.confidence.
  async find(searchDto: SearchDto): Promise<CompanyFoundDto[]> {
    const results: CompanyFoundDto[] = [];

    if (searchDto.companyId && searchDto.country) {
      const company = await this.get(searchDto.country, searchDto.companyId, searchDto.atTime);
      if (company) {
        results.push({
          confidence: MongoRepositoryService.confidenceByCompanyIdAndCountry,
          foundBy: 'Repository by companyId and country',
          company: company,
        });
      }
    }
    if (searchDto.companyName) {
      results.push(
        ...(await this.findByName(searchDto.companyName, searchDto.atTime)).map(function (company) {
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

  private async findByName(name: string, atTime?: Date): Promise<Company[]> {
    const companies: Company[] = [];
    for (const dbObject of await this.companyModel.find({ companyName: name })) {
      const recordAtTime = await this.get(dbObject.country, dbObject.companyId, atTime);

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
    companyId: insertOrUpdate.companyId,
    country: insertOrUpdate.country,
    companyName: insertOrUpdate.companyName,
    dataSource: insertOrUpdate.dataSource,
    isic: insertOrUpdate.isic,
    created: new Date(),
    requestType: RequestType.InsertOrUpdate,
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
  const dbObject: CompanyDbObject = {
    _id: company.id,
    companyId: company.companyId,
    country: company.country,
    companyName: company.companyName,
    isic: company.isic,
    created: company.created,
    lastUpdated: company.lastUpdated,
    dataSource: company.dataSource,
  };
  if (company.isDeleted) {
    dbObject.isDeleted = true;
  }
  return dbObject;
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
  };
}

function companyDbObjectToModel(dbObject: CompanyDbObject): Company {
  if (!dbObject) {
    return;
  }
  const company = new Company({
    companyId: dbObject.companyId,
    country: dbObject.country,
    companyName: dbObject.companyName,
    isic: dbObject.isic,
    dataSource: dbObject.dataSource,
  });
  company.id = dbObject._id;
  company.created = dbObject.created;
  company.lastUpdated = dbObject.lastUpdated;
  if (dbObject.isDeleted) {
    company.isDeleted = true;
  }
  return company;
}
