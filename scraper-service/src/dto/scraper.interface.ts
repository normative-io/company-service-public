import { FetchByCompanyIdDto } from './fetch.dto';

// Defines the interface that all scrapers must implement in order to be registered with the scraper-service.
export interface IScraper {
  // A human-readable name of this scraper.
  name(): string;

  // Check determines if this scraper should be considered for the given request.
  check(FetchByCompanyIdDto): CheckResult;

  // Fetch performs the scraping business logic for the given request.
  fetch(FetchByCompanyIdDto): FetchResult;
}

export class CheckResult {
  // If true, this scraper could possibly return a result for the given request.
  // Example: the scraper likely knows about any company in country 'CH'.
  readonly isApplicable: boolean;

  // The priority that this scraper has relative to any other scrapers that may be applicable.
  // If scraperA has a lower value priority than scraperB, then scraperA should be fetched from
  // before attempting a fetch from scraperB.
  // Scrapers equal in priority will be fetched from in an undefined order.
  readonly priority?: number;
}

export class FetchResult {
  // The companies that the scraper determined matched the fetch request.
  readonly foundCompanies: FoundCompany[];
}

export class FoundCompany {
  // A percentage value (as a value between 0.0 and 1.0) of how confident this data matches the fetch request.
  // This allows clients to make heuristics if there are multiple candidates found.
  readonly confidence: number;

  // Name of the company.
  readonly name: string;

  // Scraper that found the company.
  readonly scraperName?: string;

}
