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

    makeCounterProvider({
      name: 'search_inbound_total',
      help: 'The number of search inbound requests',
      labelNames: ['country'],
    }),
    makeCounterProvider({
      name: 'search_outbound_found_in_repo_total',
      help: 'The number of search requests that are answered by the repository',
      labelNames: ['country'],
    }),
    makeCounterProvider({
      name: 'search_outbound_found_in_scrapers_total',
      help: 'The number of search requests that are answered by the Scraper Service',
      labelNames: ['country'],
    }),
    makeCounterProvider({
      name: 'search_outbound_not_found_total',
      help: 'The number of search requests for which no results are found',
      labelNames: ['country'],
    }),
    makeCounterProvider({
      name: 'search_scrapers_error_total',
      help: 'The number of search requests for which the Scraper Service throws an error',
      labelNames: ['country', 'statusCode'],
    }),
  ],
})
export class CompanyModule {}
