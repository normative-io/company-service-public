import { Injectable, Logger } from '@nestjs/common';
import { Company } from './company.model';
import { InsertOrUpdateDto } from './dto/insert-or-update.dto';
import { CompanyFoundDto } from './dto/company-found.dto';
import { Counter } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { SearchDto } from './dto/search.dto';
import { IncomingRequest } from './repository/mongo/incoming-request.model';
import { MarkDeletedDto } from './dto/mark-deleted.dto';
import { RepoService } from './services/repo.service';
import { ScraperService } from './services/scraper.service';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  // Values of the component field for searchErrorTotal.
  static readonly componentApi = 'company_api';

  // Values of the `message` field for `get` and `search` operations.
  static readonly messageCompaniesFoundInRepository = 'Companies were found in repository';
  // If a request reaches the scrapers, the response from the
  // ScraperService contains a custom message that is directly sent back.
  // This prefix is used when we did not find companies
  // and the ScraperService was not contacted. The full message
  // contains the reason why the ScraperService was not contacted.
  static readonly messageScrapersNotContactedPrefix =
    'No companies found; request not sent to the ScraperService because';

  constructor(
    private repoService: RepoService,
    private scraperService: ScraperService,
    // Some metrics for the "search" operation are related to each other:
    // search_inbound_total = search_found_total + search_not_found_total + search_error_total
    @InjectMetric('search_inbound_total')
    public searchInboundTotal: Counter<string>,
    @InjectMetric('search_found_total')
    public searchFoundTotal: Counter<string>,
    @InjectMetric('search_not_found_total')
    public searchNotFoundTotal: Counter<string>,
    @InjectMetric('search_error_total')
    public searchErrorTotal: Counter<string>,
  ) {}

  async insertOrUpdate(insertOrUpdateDto: InsertOrUpdateDto): Promise<[Company, string]> {
    return await this.repoService.insertOrUpdate(insertOrUpdateDto);
  }

  async markDeleted(markDeletedDto: MarkDeletedDto): Promise<[Company, string]> {
    return await this.repoService.markDeleted(markDeletedDto);
  }

  async listAllForTesting(): Promise<Company[]> {
    return await this.repoService.listAllForTesting();
  }

  async listAllIncomingRequestsForTesting(): Promise<IncomingRequest[]> {
    return await this.repoService.listAllIncomingRequestsForTesting();
  }

  // Search for a company based on the metadata.
  // We first search inside the repo. If matches are found, return those.
  // If the requested company was not found in the local repository,
  // this may be the first time we are encountering this company.
  // The scraper service is contacted to perform an on-demand
  // search of external data sources in order to find the company.
  // If successful, the next request for this company should be
  // found in the local repository right away.
  //
  // TODO: This is simple to understand, but it does not take into account the
  // confidence of the results found in the repo: if the actual results in
  // the repo are of low confidence (e.g., partial matches of the name),
  // should we see if the scrapers find something better?
  async search(searchDto: SearchDto): Promise<[CompanyFoundDto[], string]> {
    const country = searchDto.country;
    this.searchInboundTotal.inc({ country: country });
    const [results, message] = await this.searchEverywhere(searchDto);
    if (results.length === 0) {
      this.logger.verbose(`Could not find company anywhere; metadata: ${JSON.stringify(searchDto)}`);
      this.searchNotFoundTotal.inc({ country: country });
    }
    return [
      results
        .sort((a, b) => b.confidence - a.confidence)
        .filter(
          (elem, index, self) =>
            // Keep if this is the first index for this company's id.
            index === self.findIndex((c) => c.company.id === elem.company.id),
        ),
      message,
    ];
  }

  async searchEverywhere(searchDto: SearchDto): Promise<[CompanyFoundDto[], string]> {
    const country = searchDto.country;
    const results = await this.repoService.find(searchDto);

    if (results.length != 0) {
      this.searchFoundTotal.inc({ country: country, answered_by: 'repo' });
      return [results, CompanyService.messageCompaniesFoundInRepository];
    }
    this.logger.verbose(`Could not find company in the repo; metadata: ${JSON.stringify(searchDto)}`);
    // Note: if `atTime` is specified, the scraping portion is skipped
    // because the client is requesting data from the past anyways.
    if (searchDto.atTime) {
      const message = `${CompanyService.messageScrapersNotContactedPrefix} "atTime" was set`;
      this.logger.debug(message);
      return [results, message];
    }
    const [found, message] = await this.scraperService.find(searchDto);
    if (found.length != 0) {
      this.searchFoundTotal.inc({ country: country, answered_by: 'scrapers' });
      results.push(...found);
    }
    return [results, message];
  }
}
