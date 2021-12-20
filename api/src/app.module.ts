import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CompanyModule } from './company/company.module';

@Module({
  imports: [CompanyModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
