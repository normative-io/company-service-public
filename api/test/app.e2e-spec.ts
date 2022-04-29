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
import * as request from 'supertest';
import * as mongoose from 'mongoose';
import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { HttpStatus, INestApplication } from '@nestjs/common';
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

  it('Insert - Modify - Search', async () => {
    const insertCompany = await request(app.getHttpServer())
      .post('/company/v1/insertOrUpdate')
      .send([{ country: 'CH', taxId: '1', companyName: 'Original Name Inc.' }])
      .expect(HttpStatus.CREATED);
    expect(insertCompany.body).toStrictEqual([
      {
        company: {
          id: expect.any(String),
          companyName: 'Original Name Inc.',
          country: 'CH',
          companyId: expect.any(String),
          taxId: '1',
          created: expect.any(String),
          lastUpdated: expect.any(String),
        },
        message: expect.stringContaining('Inserted'),
      },
    ]);

    const updateCompany = await request(app.getHttpServer())
      .post('/company/v1/insertOrUpdate')
      .send([{ country: 'CH', taxId: '1', companyName: 'New Name Inc.' }])
      .expect(HttpStatus.CREATED);
    expect(updateCompany.body).toStrictEqual([
      {
        company: {
          id: expect.any(String),
          companyName: 'New Name Inc.',
          country: 'CH',
          companyId: expect.any(String),
          taxId: '1',
          created: expect.any(String),
          lastUpdated: expect.any(String),
        },
        message: expect.stringContaining('Updated'),
      },
    ]);

    const search = await request(app.getHttpServer())
      .post('/company/v1/search')
      .send({ companyName: 'New Name Inc.' })
      .expect(HttpStatus.CREATED);
    expect(search.body).toStrictEqual({
      companies: [
        {
          company: {
            id: expect.any(String),
            country: 'CH',
            companyId: expect.any(String),
            taxId: '1',
            companyName: 'New Name Inc.',
            created: expect.any(String),
            lastUpdated: expect.any(String),
          },
          confidence: expect.any(Number),
          foundBy: expect.any(String),
        },
      ],
      message: expect.stringContaining('found'),
    });
  });

  it('Insert - Search - Delete - Search', async () => {
    const insertOrUpdate = await request(app.getHttpServer())
      .post('/company/v1/insertOrUpdate')
      .send([
        { country: 'DE', taxId: '1', companyName: 'Dynamic Systems Inc' },
        { country: 'US', taxId: '11', companyName: 'Dynamic Systems Inc' },
      ])
      .expect(HttpStatus.CREATED);
    expect(insertOrUpdate.body).toStrictEqual([
      {
        company: {
          id: expect.any(String),
          companyName: 'Dynamic Systems Inc',
          country: 'DE',
          companyId: expect.any(String),
          taxId: '1',
          created: expect.any(String),
          lastUpdated: expect.any(String),
        },
        message: expect.stringContaining('Inserted'),
      },
      {
        company: {
          id: expect.any(String),
          companyName: 'Dynamic Systems Inc',
          country: 'US',
          companyId: expect.any(String),
          taxId: '11',
          created: expect.any(String),
          lastUpdated: expect.any(String),
        },
        message: expect.stringContaining('Inserted'),
      },
    ]);

    const search = await request(app.getHttpServer())
      .post('/company/v1/search')
      .send({ companyName: 'Dynamic Systems Inc' })
      .expect(HttpStatus.CREATED);
    expect(search.body).toStrictEqual({
      companies: [
        {
          company: {
            id: expect.any(String),
            country: 'DE',
            companyId: expect.any(String),
            taxId: '1',
            companyName: 'Dynamic Systems Inc',
            created: expect.any(String),
            lastUpdated: expect.any(String),
          },
          confidence: expect.any(Number),
          foundBy: expect.any(String),
        },
        {
          company: {
            id: expect.any(String),
            country: 'US',
            companyId: expect.any(String),
            taxId: '11',
            companyName: 'Dynamic Systems Inc',
            created: expect.any(String),
            lastUpdated: expect.any(String),
          },
          confidence: expect.any(Number),
          foundBy: expect.any(String),
        },
      ],
      message: expect.stringContaining('found'),
    });

    const secondCompanyId = search.body.companies[1].company.companyId;

    const markDeleted = await request(app.getHttpServer())
      .delete('/company/v1/markDeleted')
      .send({ companyId: secondCompanyId })
      .expect(HttpStatus.NO_CONTENT);
    expect(markDeleted.body).toStrictEqual({});

    const searchAfterDelete = await request(app.getHttpServer())
      .post('/company/v1/search')
      .send({ companyName: 'Dynamic Systems Inc' })
      .expect(HttpStatus.CREATED);
    expect(searchAfterDelete.body).toStrictEqual({
      companies: [
        {
          company: {
            id: expect.any(String),
            country: 'DE',
            companyId: expect.any(String),
            taxId: '1',
            companyName: 'Dynamic Systems Inc',
            created: expect.any(String),
            lastUpdated: expect.any(String),
          },
          confidence: expect.any(Number),
          foundBy: expect.any(String),
        },
      ],
      message: expect.stringContaining('found'),
    });
  });
});
