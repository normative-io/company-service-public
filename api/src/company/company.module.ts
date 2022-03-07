import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { COMPANY_REPOSITORY } from './repository/repository-interface';
import { HttpModule } from '@nestjs/axios';
import { PrometheusModule, makeCounterProvider } from '@willsoto/nestjs-prometheus';
import { ConfigModule } from '@nestjs/config';
import { MongoRepositoryModule } from './repository/mongo/mongo.module';
import { MongoRepositoryService } from './repository/mongo/mongo.service';
import { RepoService } from './services/repo.service';
import { ScraperService } from './services/scraper.service';

@Module({
  imports: [HttpModule, PrometheusModule.register(), ConfigModule, MongoRepositoryModule],
  controllers: [CompanyController],
  providers: [
    CompanyService,
    {
      provide: COMPANY_REPOSITORY,
      useClass: MongoRepositoryService,
    },
    RepoService,
    ScraperService,

    makeCounterProvider({
      name: 'search_inbound_total',
      help: 'The number of search inbound requests',
      labelNames: ['country'],
    }),
    makeCounterProvider({
      name: 'search_found_total',
      help: 'The number of search requests that are answered',
      labelNames: ['country', 'answered_by'],
    }),
    makeCounterProvider({
      name: 'search_not_found_total',
      help: 'The number of search requests for which no results are found',
      labelNames: ['country'],
    }),
    makeCounterProvider({
      name: 'search_error_total',
      help: 'The number of search requests for which there is an error',
      labelNames: ['country', 'status_code', 'component'],
    }),
  ],
})
export class CompanyModule {}
