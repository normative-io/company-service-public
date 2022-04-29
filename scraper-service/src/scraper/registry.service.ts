// Copyright 2022 Meta Mind AB
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LookupRequest, LookupResponse } from '../dto/lookup.dto';
import { IScraper } from '../dto/scraper.interface';
import { Counter } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
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

  constructor(
    private configService: ConfigService,
    // Some metrics for the "lookup" operation are related to each other:
    // lookup_inbound_total = lookup_found_total + lookup_not_found_total + lookup_error_total
    @InjectMetric('lookup_inbound_total')
    public lookupInboundTotal: Counter<string>,
    @InjectMetric('lookup_inbound_by_scraper_total')
    public lookupInboundByScraperTotal: Counter<string>,
    @InjectMetric('lookup_found_total')
    public lookupFoundTotal: Counter<string>,
    @InjectMetric('lookup_not_found_total')
    public lookupNotFoundTotal: Counter<string>,
    @InjectMetric('lookup_error_total')
    public lookupErrorTotal: Counter<string>,
  ) {
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
    const country = req.country;
    this.lookupInboundTotal.inc({ country: country });
    if (!req.taxId && !req.companyName) {
      this.logger.warn('Bad request: request must contain a taxId or companyName');
      this.lookupErrorTotal.inc({ country: country, status_code: HttpStatus.BAD_REQUEST });
      throw new HttpException('Request must contain a taxId or companyName', HttpStatus.BAD_REQUEST);
    }

    const [scrapers, notApplicableMessages] = this.applicableScrapers(req);
    // `applicableScrapers` will be something like:
    // 1 applicable scraper: [switzerland-scraper]
    const applicableScrapers = `${scrapers.length} applicable ${pluralize(
      'scraper',
      scrapers.length,
    )}: [${ScraperRegistry.scraperNames(scrapers)}]`;

    // `notApplicableScrapers` will be something like:
    // 1 not applicable scraper: [denmark-scraper requires a present taxId]
    const notApplicableScrapers = `${notApplicableMessages.length} not applicable ${pluralize(
      'scraper',
      notApplicableMessages.length,
    )}: [${notApplicableMessages.join(',')}]`;

    // We use `applicability` to provide more information to the caller, example:
    // "Availability of scrapers: 1 applicable scraper: [switzerland-scraper]. 1 not applicable scraper: [denmark-scraper requires a present taxId]"
    const applicability = `Availability of scrapers: ${applicableScrapers}. ${notApplicableScrapers}`;
    this.logger.debug(applicability);

    if (scrapers.length === 0) {
      const requestNotSentMessage = `Request not sent to any scraper. ${notApplicableScrapers}`;
      this.logger.log(requestNotSentMessage);
      this.lookupNotFoundTotal.inc({ country: country, reason: 'no_applicable_scraper' });
      return { companies: [], message: requestNotSentMessage };
    }

    // Lookup from each applicable scraper until a value is found.
    // Note: in the future, we may want to execute every
    // applicable scraper and/or run them all in parallel.
    for (const scraper of scrapers) {
      const scraperName = scraper.name();
      this.logger.debug(`attempting fetch for request ${JSON.stringify(req)} using scraper: ${scraperName}`);
      this.lookupInboundByScraperTotal.inc({ country: country, scraper_name: scraperName });

      try {
        const res = await scraper.lookup(req);
        if (res.companies.length > 0) {
          this.lookupFoundTotal.inc({ country: country, scraper_name: scraperName });
          return {
            companies: [{ scraperName: scraperName, companies: res.companies }],
            // `message` will start with something like:
            // 14 companies found by scraper denmark-scraper.
            message: `${res.companies.length} ${pluralize(
              'company',
              res.companies.length,
            )} found by scraper ${scraperName}. ${applicability}}`,
          };
        }
      } catch (e) {
        // TODO: Allow individual scrapers to set a custom HttpStatus.
        const message = `Lookup in ${scraperName} failed: ${e}`;
        this.logger.error(message);
        this.lookupErrorTotal.inc({
          country: country,
          scraper_name: scraperName,
          status_code: HttpStatus.INTERNAL_SERVER_ERROR,
        });
        throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
    const noMatchFoundMessage = `No match found in any scraper. ${applicability}}`;
    this.logger.log(noMatchFoundMessage);
    this.lookupNotFoundTotal.inc({ country: country, reason: 'no_match' });
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
