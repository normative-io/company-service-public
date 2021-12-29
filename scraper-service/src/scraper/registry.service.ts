import { Injectable } from '@nestjs/common';
import { FetchByCompanyIdDto } from '../dto/fetch.dto';
import { FoundCompany, IScraper } from '../dto/scraper.interface';

export const SCRAPER_REGISTRY = 'SCRAPER_REGISTRY';

@Injectable()
export class ScraperRegistry {
  scrapers: IScraper[];

  constructor() {
    // TODO: dynamically load scraper classes from a folder specified via an env var.
    this.scrapers = [];
  }

  // TODO: change return data type to include metadata about which scrapers were used.
  fetch(req: FetchByCompanyIdDto): FoundCompany[] {
    // TODO: call `check` for all registered scrapers.
    // TODO: call `fetch` in priority-order of matching scrapers.
    return [{ confidence: 1.0, name: 'some-company-name' }];
  }
}
