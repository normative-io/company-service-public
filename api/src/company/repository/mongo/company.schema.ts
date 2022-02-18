import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CompanyDocument = CompanyDbObject & Document;

@Schema()
export class CompanyDbObject {
  // NOTE: must be kept in sync with Company from company.model.ts

  @Prop()
  _id: string;

  @Prop()
  isDeleted?: boolean;

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
}

export const CompanySchema = SchemaFactory.createForClass(CompanyDbObject);
