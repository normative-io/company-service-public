import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';

@Module({
  imports: [],
  controllers: [CompanyController],
  providers: [],
})
export class CompanyModule {}
