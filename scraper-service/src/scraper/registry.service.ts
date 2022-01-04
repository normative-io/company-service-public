import { ConfigService } from '@nestjs/config';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FetchByCompanyIdDto } from '../dto/fetch.dto';
import { FoundCompany, IScraper } from '../dto/scraper.interface';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fg = require('fast-glob');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

export const SCRAPER_REGISTRY = 'SCRAPER_REGISTRY';

// Env var name for where the registry should look for scrapers.
// The value is a comma-separated list of globs that represent
// filepaths relative from the root application directory.
const SCRAPER_GLOBS = 'SCRAPER_GLOBS';
// If SCRAPER_GLOBS is not set, use this value.
const DEFAULT_SCRAPER_GLOBS = 'src/scraper/examples/*/index.ts';

@Injectable()
export class ScraperRegistry {
  logger = new Logger(ScraperRegistry.name);
  scrapers: IScraper[];

  constructor(private configService: ConfigService) {
    const scraperGlobs = this.configService.get<string>(SCRAPER_GLOBS, DEFAULT_SCRAPER_GLOBS).split(',');
    this.logger.log(`Searching for scrapers in: ${scraperGlobs}`);

    const scraperNames = new Set<string>();
    this.scrapers = [];
    for (let scraperPath of fg.sync(scraperGlobs)) {
      if (__dirname.includes('dist/')) {
        // We are running in the context of Javascript: redirect to point to the JS version of the file.
        scraperPath = scraperPath.replace('src/', 'dist/').replace('.ts', '.js');
      }

      // require() will need a relative path from the current script.
      // Local files are marked with a `./` prefix.
      const relPath = './' + path.relative(__dirname, scraperPath);
      this.logger.log(`Loading scraper from file: ${relPath}`);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const scraperSource = require(relPath);
      const scraper = new scraperSource.Scraper();

      const name = scraper.name();
      if (!name) {
        throw new Error(`Empty scraper name in ${scraperPath}`);
      }
      if (scraperNames.has(name)) {
        throw new Error(`Duplicate scraper name: ${name} in ${scraperPath}`);
      }
      scraperNames.add(name);

      this.scrapers.push(scraper);
      this.logger.log(`Registered scraper: ${name}`);
    }

    if (this.scrapers.length === 0) {
      throw new NotFoundException(`No scrapers found in: ${scraperGlobs}`);
    }
  }

  // TODO: change return data type to include metadata about which scrapers were used.
  async fetch(req: FetchByCompanyIdDto): Promise<FoundCompany[]> {
    this.logger.debug(`fetch request: ${JSON.stringify(req, undefined, 2)}`);

    // Fetch from each applicable scraper until a value is found.
    // Note: in the future, we may want to execute every
    // applicable scraper and/or run them all in parallel.
    for (const scraper of this.applicableScrapers(req)) {
      this.logger.debug(
        `attempting fetch for request ${JSON.stringify(req, undefined, 2)} using scraper: ${scraper.name()}`,
      );
      const res = await scraper.lookup(req);
      if (res.foundCompanies.length > 0) {
        return res.foundCompanies.map(function (company) {
          return {
            scraperName: scraper.name(),
            ...company,
          };
        });
      }
    }
    return [];
  }

  // Determine the set of scrapers to use.
  applicableScrapers(req: FetchByCompanyIdDto): IScraper[] {
    return this.scrapers
      .filter((scraper) => scraper.check(req).isApplicable)
      .sort((a, b) => a.check(req).priority - b.check(req).priority);
  }
}
