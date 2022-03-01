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
