import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { COMPANY_SERVICE } from './company-service.interface';
import { CompanyService } from './company.service';
import { CompanyRepositoryArray } from './repository/repository-array';
import { COMPANY_REPOSITORY } from './repository/repository-interface';

@Module({
  imports: [],
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
  ],
})
export class CompanyModule { }
