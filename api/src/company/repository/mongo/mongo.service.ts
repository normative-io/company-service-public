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

// A MongoDB-based repository for storing company data.
@Injectable()
export class MongoRepositoryService implements ICompanyRepository {
  logger = new Logger(MongoRepositoryService.name);

  constructor(
    @InjectModel(CompanyDbObject.name) private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(IncomingRequestDbObject.name) private readonly incomingRequestModel: Model<IncomingRequestDocument>,
  ) {}

  async get(country: string, companyId: string, atTime?: Date): Promise<Company | undefined> {
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

  async markDeleted(key: CompanyKeyDto): Promise<[Company, string]> {
    const session = await this.companyModel.startSession();
    let dbObject: CompanyDbObject;
    let msg: string;
    await session.withTransaction(async () => {
      this.incomingRequestModel.create(markDeletedDtoToDbObject(key));
      const mostRecent = await this.getMostRecentRecord(key);
      if (!mostRecent || !mostRecent.isDeleted) {
        const deleteRecord = new Company({ country: key.country, companyId: key.companyId });
        deleteRecord.isDeleted = true;
        dbObject = await this.companyModel.create(companyModelToDbObject(deleteRecord));
        msg = `Marked as deleted: ${JSON.stringify(key)}`;
      } else {
        dbObject = await this.companyModel.findByIdAndUpdate(
          mostRecent._id,
          { lastUpdated: new Date() },
          { returnDocument: 'after' },
        );
        msg = `Marked as up-to-date; company already marked as deleted: ${JSON.stringify(key)}`;
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

  async findByName(name: string, atTime?: Date): Promise<Company[]> {
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

function markDeletedDtoToDbObject(markDeleted: CompanyKeyDto): IncomingRequestDbObject {
  if (!markDeleted) {
    return;
  }
  return {
    companyId: markDeleted.companyId,
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
  // The code assumes that `company.isDeleted` is only populated if it is true,
  // and equality checks would fail if we put a value of `false`.
  if (dbObject.isDeleted) {
    company.isDeleted = true;
  }
  return company;
}
