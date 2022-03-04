import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IncomingRequestDocument = IncomingRequestDbObject & Document;

@Schema()
export class IncomingRequestDbObject {
  @Prop()
  requestType: string;

  @Prop()
  companyId?: string;

  @Prop()
  country?: string;

  @Prop()
  companyName?: string;

  @Prop()
  isic?: string;

  @Prop()
  created: Date;

  @Prop()
  dataSource?: string;

  @Prop()
  taxId?: string;
}

export const IncomingRequestSchema = SchemaFactory.createForClass(IncomingRequestDbObject);
