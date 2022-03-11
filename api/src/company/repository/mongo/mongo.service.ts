// Copyright 2022 Meta Mind AB
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Company } from '../../company.model';
import { ICompanyRepository } from '../repository-interface';
import { ClientSession, Model } from 'mongoose';
import { CompanyDbObject, CompanyDocument } from './company.schema';
import { IncomingRequestDbObject, IncomingRequestDocument } from './incoming-request.schema';
import { InsertOrUpdateDto } from 'src/company/dto/insert-or-update.dto';
import { IncomingRequest, RequestType } from './incoming-request.model';
import { MarkDeletedDto } from 'src/company/dto/mark-deleted.dto';

// A MongoDB-based repository for storing company data.
@Injectable()
export class MongoRepositoryService implements ICompanyRepository {
  logger = new Logger(MongoRepositoryService.name);

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

  // Fetch the most recent metadata of a particular company, even if it is deleted.
  // See `get` to skip deleted records.
  async getMostRecentCompany(companyId: string): Promise<Company> {
    return companyDbObjectToModel(await this.getMostRecentRecord(companyId));
  }

  async insertOrUpdate(
    insertOrUpdateDto: InsertOrUpdateDto,
    newCompany: Company,
    existingCompany: Company | undefined,
  ): Promise<[Company, string]> {
    this.incomingRequestModel.create(insertOrUpdateDtoToDbObject(insertOrUpdateDto));
    const prettyRequest = `${JSON.stringify(insertOrUpdateDto)}`;
    const prettyNewCompany = `${JSON.stringify(newCompany)}`;

    if (!existingCompany) {
      const companyDbObject = await this.companyModel.create(companyModelToDbObject(newCompany));
      const msg = `Inserted an initial record for company: ${prettyNewCompany}`;
      return [companyDbObjectToModel(companyDbObject), msg];
    }

    if (newCompany.isMetadataEqual(existingCompany)) {
      return [
        companyDbObjectToModel(
          await this.companyModel.findByIdAndUpdate(
            existingCompany.id,
            { lastUpdated: new Date() },
            { returnDocument: 'after' },
          ),
        ),
        `Marked as up-to-date; metadata is equal to the most recent record: ${prettyRequest}`,
      ];
    }

    return [
      companyDbObjectToModel(await this.companyModel.create(companyModelToDbObject(newCompany))),
      `Updated metadata for company: ${prettyNewCompany}`,
    ];
  }

  async startSession(): Promise<ClientSession> {
    return await this.companyModel.startSession();
  }

  async markDeleted(dto: MarkDeletedDto, mostRecent: Company): Promise<[Company, string]> {
    this.incomingRequestModel.create(markDeletedDtoToDbObject(dto));
    const prettyRequest = `${JSON.stringify(dto)}`;
    if (!mostRecent.isDeleted) {
      // The data we create the company with doesn't really matter, as long as
      // we set `isDeleted` and the companyId. We add the country because it's
      // required in the dto.
      const deletedCompany = new Company({ country: mostRecent.country }, mostRecent.companyId);
      deletedCompany.isDeleted = true;
      return [
        companyDbObjectToModel(await this.companyModel.create(companyModelToDbObject(deletedCompany))),
        `Marked as deleted: ${prettyRequest}`,
      ];
    }
    return [
      companyDbObjectToModel(
        await this.companyModel.findByIdAndUpdate(
          mostRecent.id,
          { lastUpdated: new Date() },
          { returnDocument: 'after' },
        ),
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

  // Find companies that match the given argument.
  // If `atTime` unset, return the most recent matching metadata for the company.
  // If `atTime` is set, return the metadata at that particular time.
  // Results are sorted by creation time.
  //
  // TODO: We sort results by creation time because the tests expect older elements first,
  // but that's an arbitrary way of sorting and it is not required by the business logic.
  // Make tests order-agnostic instead of sorting here.
  async find(matchers: any[], atTime?: Date): Promise<Company[]> {
    let matcher: any = {};
    for (const m of matchers) {
      matcher = { ...matcher, ...m };
    }
    if (atTime) {
      matcher = { ...matcher, created: { $lte: atTime } };
    }

    const companies: Company[] = [];
    for (const companyId of await this.companyModel.distinct('companyId', matcher)) {
      const recordAtTime = await this.get(companyId, atTime);

      if (recordAtTime) {
        companies.push(recordAtTime);
      }
    }
    return [...companies.sort((a, b) => a.created.getTime() - b.created.getTime())];
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
    // Always set this field, it's easier to make mistakes in SQL queries
    // if there are null fields, and this is an important one.
    isDeleted: company.isDeleted ? true : false,
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
