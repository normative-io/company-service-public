import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { COMPANY_SERVICE } from './company-service.interface';
import { InMemoryCompanyService } from './inmemory/company.service';

@Module({
  imports: [],
  controllers: [CompanyController],
  providers: [
    {
      provide: COMPANY_SERVICE,
      useClass: InMemoryCompanyService,
    },
  ],
})
export class CompanyModule { }
