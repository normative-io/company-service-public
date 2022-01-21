import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CompanyDocument = Company & Document;

@Schema()
export class Company {
  @Prop()
  companyId: string;

  @Prop()
  companyName: string;

  @Prop()
  country: string;
}

export const CompanySchema = SchemaFactory.createForClass(Company);
