import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Company } from '../../company.model';
import { ICompanyRepository } from '../repository-interface';
import { Model } from 'mongoose';
import { CompanyDbObject, CompanyDocument } from './company.schema';

// A MongoDB-based repository for storing company data.
@Injectable()
export class MongoRepositoryService implements ICompanyRepository {
  logger = new Logger(MongoRepositoryService.name);

  constructor(@InjectModel(CompanyDbObject.name) private readonly companyModel: Model<CompanyDocument>) {}

  async get(country: string, companyId: string, atTime?: Date): Promise<Company | undefined> {
    const dbObjects = await this.companyModel.find({ country, companyId }).sort('-created');
    if (!atTime && dbObjects.length > 0) {
      return dbObjectToModel(dbObjects[0]);
    }
    // The first item in this descending-creation-time-ordered
    // list that was created before `atTime` is the record
    // that was active during the requested `atTime`.
    for (const dbObject of dbObjects) {
      if (dbObject.created <= atTime) {
        return dbObjectToModel(dbObject);
      }
    }
  }

  async exists(company: Company): Promise<boolean> {
    // TODO: properly integrate checking for company presence.
    return await this.companyModel.exists({
      companyId: company.companyId,
      country: company.country,
    });
  }

  async save(company: Company): Promise<Company> {
    // TODO: properly implement an append-only interface.
    const dbObject = await this.companyModel.findByIdAndUpdate(company.id, modelToDbObject(company), {
      upsert: true,
      new: true,
    });
    const newCompany = dbObjectToModel(dbObject);
    this.logger.log(`Saved company ${JSON.stringify(newCompany, undefined, 2)}`);
    return newCompany;
  }

  async listAll(): Promise<Company[]> {
    const companies: Company[] = [];
    for (const dbObject of await this.companyModel.find()) {
      companies.push(dbObjectToModel(dbObject));
    }
    return [...companies];
  }

  async getById(id: string): Promise<Company> {
    const dbObject = await this.companyModel.findById(id);
    if (!dbObject) {
      throw new NotFoundException(`Could not find company with id '${id}'`);
    }
    return dbObjectToModel(dbObject);
  }

  async delete(id: string): Promise<void> {
    const dbObject = await this.companyModel.findByIdAndDelete(id);
    if (!dbObject) {
      throw new NotFoundException(`Could not find company with id '${id}'`);
    }
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

  async findByCompanyIdAndCountry(companyId: string, country: string): Promise<Company> {
    const dbObject = await this.companyModel.findOne({ companyId: companyId, country: country });
    if (!dbObject) {
      return;
    }
    return dbObjectToModel(dbObject);
  }
}

function modelToDbObject(company: Company): CompanyDbObject {
  return {
    _id: company.id,
    companyId: company.companyId,
    country: company.country,
    companyName: company.companyName,
    isic: company.isic,
    created: company.created,
  };
}

function dbObjectToModel(dbObject: CompanyDbObject): Company {
  const company = new Company({
    companyId: dbObject.companyId,
    country: dbObject.country,
    companyName: dbObject.companyName,
    isic: dbObject.isic,
  });
  company.id = dbObject._id;
  company.created = dbObject.created;
  return company;
}
