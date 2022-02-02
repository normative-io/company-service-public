import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { COMPANY_REPOSITORY } from './repository/repository-interface';
import { HttpModule } from '@nestjs/axios';
import { PrometheusModule, makeCounterProvider } from '@willsoto/nestjs-prometheus';
import { ConfigModule } from '@nestjs/config';
import { MongoRepositoryModule } from './repository/mongo/mongo.module';
import { MongoRepositoryService } from './repository/mongo/mongo.service';

@Module({
  imports: [HttpModule, PrometheusModule.register(), ConfigModule, MongoRepositoryModule],
  controllers: [CompanyController],
  providers: [
    CompanyService,
    {
      provide: COMPANY_REPOSITORY,
      useClass: MongoRepositoryService,
    },

    makeCounterProvider({ name: 'find_inbound_total', help: 'The number of find inbound requests' }),
    makeCounterProvider({
      name: 'find_outbound_found_in_repo_total',
      help: 'The number of find requests that are answered by the repo',
    }),
    makeCounterProvider({
      name: 'find_outbound_found_in_scrapers_total',
      help: 'The number of find requests that are answered by the Scrapers Service',
    }),
    makeCounterProvider({
      name: 'find_outbound_not_found_total',
      help: 'The number of find requests for which no results are found',
    }),
    makeCounterProvider({
      name: 'find_scrapers_error_total',
      help: 'The number of find requests for which the Scrapers Service throws an error',
    }),
  ],
})
export class CompanyModule {}
