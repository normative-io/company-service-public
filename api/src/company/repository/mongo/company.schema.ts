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
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CompanyDocument = CompanyDbObject & Document;

@Schema()
export class CompanyDbObject {
  // NOTE: must be kept in sync with Company from company.model.ts

  @Prop()
  _id: string;

  @Prop()
  isDeleted: boolean;

  @Prop()
  companyId: string;

  @Prop()
  country: string;

  @Prop()
  companyName: string;

  @Prop()
  isic: string;

  @Prop()
  created: Date;

  @Prop()
  lastUpdated: Date;

  @Prop()
  dataSource: string;

  @Prop()
  taxId: string;

  @Prop()
  orgNbr: string;
}

export const CompanySchema = SchemaFactory.createForClass(CompanyDbObject);
