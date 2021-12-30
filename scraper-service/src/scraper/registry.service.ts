import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { FetchByCompanyIdDto } from '../dto/fetch.dto';
import { FoundCompany, IScraper } from '../dto/scraper.interface';
import { DenmarkScraper } from './examples/denmark-scraper';

export const SCRAPER_REGISTRY = 'SCRAPER_REGISTRY';

const DEFAULT_SCRAPER_PATHS = 'examples/';

@Injectable()
export class ScraperRegistry {
  scrapers: IScraper[];

  constructor(private configService: ConfigService) {
    // TODO: dynamically load scraper classes from a folder specified via an env var.
    const scraperPaths = this.configService
      .get<string>('SCRAPER_PATHS', DEFAULT_SCRAPER_PATHS)
      .split(',');
    console.log(`Using scraper paths: ${scraperPaths}`);

    this.scrapers = [new DenmarkScraper()];
  }

  // TODO: change return data type to include metadata about which scrapers were used.
  fetch(req: FetchByCompanyIdDto): FoundCompany[] {
    console.log(`fetch request: ${JSON.stringify(req, undefined, 2)}`);

    // Determine the set of scrapers to use.
    const applicableScrapers = this.scrapers
      .filter((s) => s.check(req).isApplicable)
      .sort((a, b) => a.check(req).priority - b.check(req).priority);

    // Fetch from each applicable scraper until a value is found.
    // Note: in the future, we may want to execute every
    // applicable scraper and/or run them all in parallel.
    for (let s of applicableScrapers) {
      console.log(
        `attempting fetch for request ${JSON.stringify(
          req,
          undefined,
          2,
        )} using scraper: ${s.name()}`,
      );
      const res = s.fetch(req);
      if (res.foundCompanies.length > 0) {
        return res.foundCompanies.map(function (e) {
          return {
            scraperName: s.name(),
            ...e,
          }
        });
      }
    }
    return [];
  }
}
