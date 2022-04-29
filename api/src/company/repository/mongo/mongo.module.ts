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
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyDbObject, CompanySchema } from './company.schema';
import { IncomingRequestDbObject, IncomingRequestSchema } from './incoming-request.schema';

const schemas = [
  { name: CompanyDbObject.name, schema: CompanySchema },
  { name: IncomingRequestDbObject.name, schema: IncomingRequestSchema },
];

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const uri = configService.get<string>('MONGO_URI');
        return { uri };
      },
      inject: [ConfigService],
    }),
    MongooseModule.forFeature(schemas),
  ],
  exports: [MongooseModule.forFeature(schemas)],
})
export class MongoRepositoryModule {}
