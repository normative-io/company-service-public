import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyDbObject, CompanySchema } from './company.schema';

const schemas = [{ name: CompanyDbObject.name, schema: CompanySchema }];

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
