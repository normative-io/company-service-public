import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Company } from '../../company.model';
import { ICompanyRepository } from '../repository-interface';
import { Model } from 'mongoose';
import { CompanyDbObject, CompanyDocument } from './company.schema';
import { InsertOrUpdateDto } from 'src/company/dto/insert-or-update.dto';
import { CompanyKeyDto } from 'src/company/dto/company-key.dto';

// A MongoDB-based repository for storing company data.
@Injectable()
export class MongoRepositoryService implements ICompanyRepository {
  logger = new Logger(MongoRepositoryService.name);

  constructor(@InjectModel(CompanyDbObject.name) private readonly companyModel: Model<CompanyDocument>) {}

  async get(country: string, companyId: string, atTime?: Date): Promise<Company | undefined> {
    if (!atTime) {
      const mostRecent = await this.getMostRecentRecord({ country, companyId });
      if (!mostRecent || mostRecent.isDeleted) {
        return; // Deleted records should not be returned.
      }
      return dbObjectToModel(mostRecent);
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
        return dbObjectToModel(dbObject);
      }
    }
  }

  async insertOrUpdate(insertOrUpdateDto: InsertOrUpdateDto): Promise<[Company, string]> {
    // Operation is performed in a transaction to avoid race conditions
    // between checking the most recent record and inserting a new one.
    const session = await this.companyModel.startSession();
    let dbObject: CompanyDbObject;
    let msg: string;
    await session.withTransaction(async () => {
      const newRecord = new Company(insertOrUpdateDto);
      const mostRecent = dbObjectToModel(await this.getMostRecentRecord(insertOrUpdateDto));
      if (newRecord.isMetadataEqual(mostRecent)) {
        dbObject = await this.companyModel.findByIdAndUpdate(
          mostRecent.id,
          { lastUpdated: new Date() },
          { returnDocument: 'after' },
        );
        msg = `Marked as up-to-date; metadata is equal to the most recent record: ${JSON.stringify(insertOrUpdateDto)}`;
      } else {
        dbObject = await this.companyModel.create(modelToDbObject(newRecord));
        if (mostRecent) {
          msg = `Updated metadata for company: ${JSON.stringify(insertOrUpdateDto)}`;
        } else {
          msg = `Inserted an initial record for company: ${JSON.stringify(insertOrUpdateDto)}`;
        }
      }
    });
    session.endSession();
    this.logger.debug(msg);
    return [dbObjectToModel(dbObject), msg];
  }

  async markDeleted(key: CompanyKeyDto): Promise<[Company, string]> {
    const session = await this.companyModel.startSession();
    let dbObject: CompanyDbObject;
    let msg: string;
    await session.withTransaction(async () => {
      const mostRecent = await this.getMostRecentRecord(key);
      if (!mostRecent || !mostRecent.isDeleted) {
        const deleteRecord = new Company({ country: key.country, companyId: key.companyId });
        deleteRecord.isDeleted = true;
        dbObject = await this.companyModel.create(modelToDbObject(deleteRecord));
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
    return [dbObjectToModel(dbObject), msg];
  }

  private async getMostRecentRecord(key: CompanyKeyDto): Promise<CompanyDbObject> {
    return await this.companyModel.findOne({ country: key.country, companyId: key.companyId }).sort('-created');
  }

  async listAllForTesting(): Promise<Company[]> {
    const companies: Company[] = [];
    for (const dbObject of await this.companyModel.find()) {
      companies.push(dbObjectToModel(dbObject));
    }
    return [...companies];
  }

  async findById(id: string): Promise<Company | undefined> {
    const dbObject = await this.companyModel.findById(id);
    if (!dbObject) {
      return;
    }
    return dbObjectToModel(dbObject);
  }

  async findByName(name: string): Promise<Company[]> {
    const companies: Company[] = [];
    for (const dbObject of await this.companyModel.find({ companyName: name })) {
      companies.push(dbObjectToModel(dbObject));
    }
    return [...companies];
  }
}

function modelToDbObject(company: Company): CompanyDbObject {
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
  };
  if (company.isDeleted) {
    dbObject.isDeleted = true;
  }
  return dbObject;
}

function dbObjectToModel(dbObject: CompanyDbObject): Company {
  if (!dbObject) {
    return;
  }
  const company = new Company({
    companyId: dbObject.companyId,
    country: dbObject.country,
    companyName: dbObject.companyName,
    isic: dbObject.isic,
  });
  company.id = dbObject._id;
  company.created = dbObject.created;
  company.lastUpdated = dbObject.lastUpdated;
  if (dbObject.isDeleted) {
    company.isDeleted = true;
  }
  return company;
}
