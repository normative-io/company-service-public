import * as request from 'supertest';
import * as mongoose from 'mongoose';
import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { CompanyDbObject, CompanyDocument } from '../src/company/repository/mongo/company.schema';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let companyModel: mongoose.Model<CompanyDocument>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    companyModel = module.get(getModelToken(CompanyDbObject.name));

    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    await companyModel.deleteMany({}); // Each test starts with an empty db.
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('Company Service');
  });
});
