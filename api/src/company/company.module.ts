import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { COMPANY_SERVICE } from './company-service.interface';
import { CompanyService } from './company.service';
import { CompanyRepositoryArray } from './repository/repository-array';
import { COMPANY_REPOSITORY } from './repository/repository-interface';
import { SCRAPER_SERVICE } from './scraper/service-interface';
import { HttpModule } from '@nestjs/axios';
import { ScraperService } from './scraper/service-scraper';

@Module({
  imports: [HttpModule],
  controllers: [CompanyController],
  providers: [
    {
      provide: COMPANY_SERVICE,
      useClass: CompanyService,
    },
    {
      provide: COMPANY_REPOSITORY,
      useClass: CompanyRepositoryArray,
    },
    {
      provide: SCRAPER_SERVICE,
      useClass: ScraperService,
    },
  ],
})
export class CompanyModule { }
