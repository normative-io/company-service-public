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

  it('TEST 0: / (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('Company Service');
  });

  it('TEST 1: Insert - Modify - Search', async () => {
    const response = await request(app.getHttpServer())
      .post('/company/v1/insertOrUpdate')
      .send([{ country: 'CH', companyId: '1', companyName: 'Nonexisting INC' }])
      .expect(HttpStatus.CREATED);
    expect(response.body).toStrictEqual([
      {
        company: {
          id: expect.any(String),
          companyName: 'Nonexisting INC',
          country: 'CH',
          companyId: '1',
          created: expect.any(String),
          lastUpdated: expect.any(String),
        },
        message: expect.stringContaining('Inserted'),
      },
    ]);
    const response2 = await request(app.getHttpServer())
      .post('/company/v1/insertOrUpdate')
      .send([{ country: 'CH', companyId: '1', companyName: 'Nowexisting INC' }])
      .expect(HttpStatus.CREATED);
    expect(response2.body).toStrictEqual([
      {
        company: {
          id: expect.any(String),
          companyName: 'Nowexisting INC',
          country: 'CH',
          companyId: '1',
          created: expect.any(String),
          lastUpdated: expect.any(String),
        },
        message: expect.stringContaining('Updated'),
      },
    ]);

    const response3 = await request(app.getHttpServer())
      .post('/company/v1/search')
      .send({ companyName: 'Nowexisting INC' })
      .expect(HttpStatus.CREATED);
    expect(response3.body).toStrictEqual({
      companies: [
        {
          company: {
            id: expect.any(String),
            country: 'CH',
            companyId: '1',
            companyName: 'Nowexisting INC',
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

  it('TEST 2: Insert - Delete - Search', async () => {
    const response = await request(app.getHttpServer())
      .post('/company/v1/insertOrUpdate')
      .send([
        { country: 'CH', companyId: '1', companyName: 'Nonexisting INC' },
        { country: 'IT', companyId: '11', companyName: 'Nuova SPA' },
      ])
      .expect(HttpStatus.CREATED);
    expect(response.body).toStrictEqual([
      {
        company: {
          id: expect.any(String),
          companyName: 'Nonexisting INC',
          country: 'CH',
          companyId: '1',
          created: expect.any(String),
          lastUpdated: expect.any(String),
        },
        message: expect.stringContaining('Inserted'),
      },
      {
        company: {
          id: expect.any(String),
          companyName: 'Nuova SPA',
          country: 'IT',
          companyId: '11',
          created: expect.any(String),
          lastUpdated: expect.any(String),
        },
        message: expect.stringContaining('Inserted'),
      },
    ]);
    const response2 = await request(app.getHttpServer())
      .delete('/company/v1/markDeleted')
      .send({ country: 'IT', companyId: '11' })
      .expect(HttpStatus.NO_CONTENT);
    expect(response2.body).toStrictEqual({});

    const response3 = await request(app.getHttpServer())
      .post('/company/v1/search')
      .send({ companyId: '11' })
      .expect(HttpStatus.CREATED);
    expect(response3.body).toStrictEqual({
      companies: [
        {
          company: {
            id: expect.any(String),
            country: 'IT',
            companyId: '11',
            companyName: 'Nuova SPA',
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
