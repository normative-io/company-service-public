import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { ScraperRegistry, SCRAPER_REGISTRY } from './registry.service';
import { ScraperController } from './scraper.controller';

@Module({
  imports: [ConfigModule],
  controllers: [ScraperController],
  providers: [
    {
      provide: SCRAPER_REGISTRY,
      useClass: ScraperRegistry,
    },
  ],
})
export class ScraperModule {}
