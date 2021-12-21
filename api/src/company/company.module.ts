import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { InMemoryCompanyService } from './inmemory.company.service';

@Module({
  imports: [],
  controllers: [CompanyController],
  providers: [InMemoryCompanyService],
})
export class CompanyModule { }
