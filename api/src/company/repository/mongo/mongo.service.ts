import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Company } from '../../company.model';
import { ICompanyRepository } from '../repository-interface';
import { Model } from 'mongoose';

// A MongoDB-based repository for storing company data.
@Injectable()
export class MongoRepositoryService implements ICompanyRepository {
  logger = new Logger(MongoRepositoryService.name);

  exists(company: Company): boolean {
    // TODO: implement.
    return false;
  }

  save(company: Company): Company {
    // TODO: implement.
    return undefined;
  }

  listAll(): Company[] {
    // TODO: implement.
    return [];
  }

  getById(id: string): Company {
    // TODO: implement.
    return undefined;
  }

  delete(id: string): void {
    // TODO: implement.
  }

  findById(id: string): Company | undefined {
    // TODO: implement.
    return undefined;
  }

  findByName(name: string): Company[] {
    // TODO: implement.
    return [];
  }

  findByCompanyIdAndCountry(companyId: string, country: string): Company | undefined {
    // TODO: implement.
    return undefined;
  }
}
