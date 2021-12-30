import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { COMPANY_SERVICE } from './company-service.interface';
import { CompanyService } from './company.service';
import { CompanyRepositoryArray } from './repository/repository-array';
import { COMPANY_REPOSITORY } from './repository/repository-interface';
import { SCRAPER_SERVICE } from './scraper/service-interface';
import { HttpModule } from '@nestjs/axios';
import { ScraperService } from './scraper/service-scraper';
import { PrometheusModule, makeCounterProvider } from "@willsoto/nestjs-prometheus";

@Module({
  imports: [HttpModule, PrometheusModule.register()],
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

    makeCounterProvider({ name: "find_inbound_total", help: "The number of find inbound requests" }),
    makeCounterProvider({ name: "find_outbound_found_in_repo_total", help: "The number of find requests that are answered by the repo" }),
    makeCounterProvider({ name: "find_outbound_found_in_scrapers_total", help: "The number of find requests that are answered by the Scrapers Service" }),
    makeCounterProvider({ name: "find_outbound_not_found_total", help: "The number of find requests for which no results are found" }),
    makeCounterProvider({ name: "find_scrapers_error_total", help: "The number of find requests for which the Scrapers Service throws an error" }),
  ],
})
export class CompanyModule { }
