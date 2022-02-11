import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LookupRequest, LookupResponse } from '../dto/lookup.dto';
import { IScraper } from '../dto/scraper.interface';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fg = require('fast-glob');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pluralize = require('pluralize');

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

  async lookup(req: LookupRequest): Promise<LookupResponse> {
    this.logger.debug(`lookup request: ${JSON.stringify(req)}`);
    if (!req.companyId && !req.companyName) {
      this.logger.warn('Bad request: request must contain a companyId or companyName');
      throw new HttpException('Request must contain a companyId or companyName', HttpStatus.BAD_REQUEST);
    }

    const [scrapers, notApplicableMessages] = this.applicableScrapers(req);
    // `applicableScrapers` will be something like:
    // 1 applicable scraper: [switzerland-scraper]
    const applicableScrapers = `${scrapers.length} applicable ${pluralize(
      'scraper',
      scrapers.length,
    )}: [${ScraperRegistry.scraperNames(scrapers)}]`;

    // `notApplicableScrapers` will be something like:
    // 1 not applicable scraper: [denmark-scraper requires a present companyId]
    const notApplicableScrapers = `${notApplicableMessages.length} not applicable ${pluralize(
      'scraper',
      notApplicableMessages.length,
    )}: [${notApplicableMessages.join(',')}]`;

    // We use `applicability` to provide more information to the caller, example:
    // "Availability of scrapers: 1 applicable scraper: [switzerland-scraper]. 1 not applicable scraper: [denmark-scraper requires a present companyId]"
    const applicability = `Availability of scrapers: ${applicableScrapers}. ${notApplicableScrapers}`;
    this.logger.debug(applicability);

    if (scrapers.length === 0) {
      const requestNotSentMessage = `Request not sent to any scraper. ${notApplicableScrapers}`;
      this.logger.log(requestNotSentMessage);
      return { companies: [], message: requestNotSentMessage };
    }

    // Lookup from each applicable scraper until a value is found.
    // Note: in the future, we may want to execute every
    // applicable scraper and/or run them all in parallel.
    for (const scraper of scrapers) {
      this.logger.debug(`attempting fetch for request ${JSON.stringify(req)} using scraper: ${scraper.name()}`);

      try {
        const res = await scraper.lookup(req);
        if (res.companies.length > 0) {
          return {
            companies: [{ scraperName: scraper.name(), companies: res.companies }],
            // `message` will start with something like:
            // 14 companies found by scraper denmark-scraper.
            message: `${res.companies.length} ${pluralize(
              'company',
              res.companies.length,
            )} found by scraper ${scraper.name()}. ${applicability}}`,
          };
        }
      } catch (e) {
        // TODO: Allow individual scrapers to set a custom HttpStatus.
        const message = `Lookup in ${scraper.name()} failed: ${e}`;
        this.logger.error(message);
        throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
    const noMatchFoundMessage = `No match found in any scraper. ${applicability}}`;
    this.logger.log(noMatchFoundMessage);
    return { companies: [], message: noMatchFoundMessage };
  }

  // Determine the set of scrapers to use.
  // The list of strings contains information about which scrapers are not applicable.
  applicableScrapers(req: LookupRequest): [IScraper[], string[]] {
    const applicable: IScraper[] = [];
    const notApplicable: string[] = [];
    for (const scraper of this.scrapers) {
      const check = scraper.check(req);
      if (check.isApplicable) {
        applicable.push(scraper);
      } else {
        notApplicable.push(`${scraper.name()} ${check.reason}`);
      }
    }
    return [applicable.sort((a, b) => a.check(req).priority - b.check(req).priority), notApplicable];
  }

  scraperNames(): string {
    return ScraperRegistry.scraperNames(this.scrapers);
  }

  static scraperNames(scrapers: IScraper[]): string {
    return scrapers.map((s) => s.name()).join(',');
  }
}
