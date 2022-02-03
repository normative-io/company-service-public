import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CompanyModule } from './company/company.module';
import { LoggerModule } from './logger/logger.module';

@Module({
  imports: [LoggerModule, CompanyModule, ConfigModule.forRoot()],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
