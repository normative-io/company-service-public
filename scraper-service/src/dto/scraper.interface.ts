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
import { LookupRequest } from './lookup.dto';

// Defines the interface that all scrapers must implement in order to be registered with the scraper-service.
export interface IScraper {
  // A human-readable name of this scraper.
  name(): string;

  // Check determines if this scraper should be considered for the given request.
  check(req: LookupRequest): CheckResult;

  // Lookup performs the scraping business logic for the given request.
  lookup(req: LookupRequest): Promise<LookupResponse>;
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

  // Explanatory text about why this scraper does not apply to the given request.
  // Use in conjunction with `isApplicable=false`.
  readonly reason?: string;
}

export class LookupResponse {
  // The companies that the scraper determined matched the fetch request.
  readonly companies: FoundCompany[];
}

export class FoundCompany {
  constructor(
    // Metadata of the company that was found.
    public readonly company: Company,
    // A percentage value (as a value between 0.0 and 1.0) of how confident this data matches the fetch request.
    // This allows clients to make heuristics if there are multiple candidates found.
    public readonly confidence: number,
  ) {}
}

export class Company {
  constructor(
    // Name of the company.
    public readonly companyName: string,
    // ISIC rev 4 of the company
    public readonly isic: string,
    // The country of the company
    public readonly country: string,
    // Tax ID of the company
    public readonly taxId?: string,
  ) {}
}
