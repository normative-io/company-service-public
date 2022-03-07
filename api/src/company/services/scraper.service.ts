import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InsertOrUpdateDto } from '../dto/insert-or-update.dto';
import { CompanyFoundDto, ScraperServiceResponse } from '../dto/company-found.dto';
import { Counter } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { ConfigService } from '@nestjs/config';
import { SearchDto } from '../dto/search.dto';
import fetch from 'node-fetch';
import { RepoService } from './repo.service';

// This service interfaces with the external Scraper Service.
@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  // Values of the component field for searchErrorTotal.
  static readonly componentScrapers = 'scraper_service';

  private scraperServiceAddress;

  constructor(
    private configService: ConfigService,
    private repoService: RepoService,
    @InjectMetric('search_error_total')
    public searchErrorTotal: Counter<string>,
  ) {
    const scraperAddress = this.configService.get<string>('SCRAPER_ADDRESS');
    this.scraperServiceAddress = `http://${scraperAddress}/scraper/lookup`;
    this.logger.log(`Will use Scraper Service on address: ${this.scraperServiceAddress}`);
  }

  // There are three main error situations when contacting the ScraperService:
  // 1. We cannot contact the ScraperService
  // 2. The ScraperService returns a failure
  // 3. We cannot parse the response
  // Each of these increment `this.findScraperErrorTotal` and throw an HTTPException with
  // a descriptive message.
  async find(searchDto: SearchDto): Promise<[CompanyFoundDto[], string]> {
    const country = searchDto.country;
    if (Object.keys(searchDto).length === 0) {
      throw new HttpException(`Search request cannot be empty`, HttpStatus.BAD_REQUEST);
    }
    let response;
    try {
      response = await fetch(this.scraperServiceAddress, {
        method: 'post',
        body: JSON.stringify(searchDto),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      const message = `Cannot contact ScraperService, is the service available? ${e}`;
      this.logger.error(message);
      this.searchErrorTotal.inc({
        country: country,
        status_code: HttpStatus.SERVICE_UNAVAILABLE,
        component: ScraperService.componentScrapers,
      });
      throw new HttpException(message, HttpStatus.SERVICE_UNAVAILABLE);
    }
    const jsonResponse = await response.json();
    if (!response.ok) {
      this.logger.debug(`Fetched failed response (status=${response.status}) ${JSON.stringify(jsonResponse)}`);
      // A failed response is of the form:
      // {"statusCode":501,"message":"No suitable scrapers for the request"}
      const message = `Request to ScraperService failed: ${jsonResponse.message}`;
      this.logger.error(message);
      this.searchErrorTotal.inc({
        country: country,
        status_code: response.status,
        component: ScraperService.componentScrapers,
      });
      throw new HttpException(message, response.status);
    }
    const scraperResponse = jsonResponse as ScraperServiceResponse;
    this.logger.debug(`Fetched response from ScraperService: ${JSON.stringify(scraperResponse)}`);
    return this.toCompanies(scraperResponse, country);
  }

  private async toCompanies(response: ScraperServiceResponse, country: string): Promise<[CompanyFoundDto[], string]> {
    const results: CompanyFoundDto[] = [];
    this.logger.verbose(`Extracting companies from response: ${JSON.stringify(response)}`);
    const companies = response.companies;
    const message = response.message;
    if (!companies) {
      return [results, message];
    }
    try {
      for (const scraperResponse of companies) {
        const scraperName = scraperResponse.scraperName;
        this.logger.verbose(`Processing response from scraper ${scraperName}: ${JSON.stringify(scraperResponse)}`);
        for (const dto of scraperResponse.companies) {
          this.logger.debug(`Processing: ${JSON.stringify(dto)}`);
          const [company] = await this.repoService.insertOrUpdate({
            dataSource: scraperName,
            ...dto.company,
          } as InsertOrUpdateDto);
          this.logger.debug(`Added company: ${JSON.stringify(company)}`);
          // Note that if the scraper returns multiple records for one company (multiple items with the same
          // identifiers), we add all of them here.
          // The caller later deduplicates based on the record's internal id, which is based on the content of the record.
          // Thus, if the ScraperService returns two or more items with exactly the same content, they are properly
          // deduped later, but if they contain slightly different content (e.g., different populated fields), all of them will be
          // returned by the search. This might be problematic: it will be almost impossible to retrieve them separately since
          // they are created at the same time.
          // TODO: Think of how to handle this, especially if the content is different. Should we dedup here (or later)
          // based on these identifiers, and if so, how do we choose what record to keep? Should we simply accept this and send
          // a warning with the results so that we can have a look later?
          results.push({
            company: company,
            confidence: dto.confidence,
            foundBy: scraperName ? `Scraper ${scraperName}` : undefined,
          });
        }
      }
    } catch (e) {
      const message = `Error parsing response from ScraperService: ${e}`;
      this.logger.error(message);
      this.searchErrorTotal.inc({
        country: country,
        status_code: HttpStatus.INTERNAL_SERVER_ERROR,
        component: ScraperService.componentScrapers,
      });
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return [results, message];
  }
}
