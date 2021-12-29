import { Inject, Module } from '@nestjs/common';
import { ScraperRegistry, SCRAPER_REGISTRY } from './registry.service';
import { ScraperController } from './scraper.controller';

@Module({
  imports: [],
  controllers: [ScraperController],
  providers: [
    {
      provide: SCRAPER_REGISTRY,
      useClass: ScraperRegistry,
    },
  ],
})
export class ScraperModule {}
