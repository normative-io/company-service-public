import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Company } from './company.model';
import { COMPANY_REPOSITORY, ICompanyRepository } from './repository/repository-interface';
import { InsertOrUpdateDto } from './dto/insert-or-update.dto';
import { CompanyFoundDto, ScraperServiceResponse } from './dto/company-found.dto';
import { Counter } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { ConfigService } from '@nestjs/config';
import { GetCompanyDto } from './dto/get-company.dto';
import { CompanyKeyDto } from './dto/company-key.dto';
import { SearchDto } from './dto/search.dto';
import fetch from 'node-fetch';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  // These confidence values have been chosen intuitively.
  static readonly confidenceById = 1;
  static readonly confidenceByCompanyIdAndCountry = 0.9;
  static readonly confidenceByName = 0.7;

  // Values of the `message` field for `get` and `search` operations.
  static readonly messageCompaniesFoundInRepository = 'Companies were found in repository';
  // If a request reaches the scrapers, the response from the
  // ScraperService contains a custom message that is directly sent back.
  // This prefix is used when we did not find companies
  // and the ScraperService was not contacted. The full message
  // contains the reason why the ScraperService was not contacted.
  static readonly messageScrapersNotContactedPrefix =
    'No companies found; request not sent to the ScraperService because';

  private scraperServiceAddress;

  constructor(
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepo: ICompanyRepository,
    private configService: ConfigService,
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
  ) {
    const scraperAddress = this.configService.get<string>('SCRAPER_ADDRESS');
    this.scraperServiceAddress = `http://${scraperAddress}/scraper/lookup`;
    this.logger.log(`Will use Scraper Service on address: ${this.scraperServiceAddress}`);
  }

  // Fetches the metadata of the requested company. First checks the repository if
  // the company is already known. If not found in the repository, contacts the
  // scraper service to check external data sources for this company.
  // Note: `atTime` represents the database-insertion time of the record and not any
  // business-related timestamp (ex: date which the company was founded or dissolved).
  async get(getCompanyDto: GetCompanyDto): Promise<[CompanyFoundDto[], string]> {
    this.logger.verbose(`Looking in repo for company: ${JSON.stringify(getCompanyDto)}`);
    const company = await this.companyRepo.get(getCompanyDto.country, getCompanyDto.companyId, getCompanyDto.atTime);
    if (company) {
      return [
        [
          {
            confidence: CompanyService.confidenceByCompanyIdAndCountry,
            foundBy: 'Repository by companyId and country',
            company: company,
          },
        ],
        CompanyService.messageCompaniesFoundInRepository,
      ];
    }
    this.logger.debug(`Could not find company in the repo: ${JSON.stringify(getCompanyDto)}`);

    // If the requested company was not found in the local repository,
    // this may be the first time we are encountering this company.
    // The scraper service should be contacted to perform an on-demand
    // search of external data sources in order to find the company.
    // If successful, the next request for this company should be
    // found in the local repository right away.
    // Note: if `atTime` is specified, the scraping portion is skipped
    // because the client is requesting data from the past anyways.
    if (!getCompanyDto.atTime) {
      this.logger.verbose(`Requesting scraper lookup for company: ${JSON.stringify(getCompanyDto)}`);
      return await this.findInScraperService({
        country: getCompanyDto.country,
        companyId: getCompanyDto.companyId,
      });
    }
    this.logger.debug(`Could not find company anywhere: ${JSON.stringify(getCompanyDto)}`);
    return [[], `${CompanyService.messageScrapersNotContactedPrefix} "atTime" was set`];
  }

  async insertOrUpdate(insertOrUpdateDto: InsertOrUpdateDto): Promise<[Company, string]> {
    return await this.companyRepo.insertOrUpdate(insertOrUpdateDto);
  }

  async markDeleted(key: CompanyKeyDto): Promise<[Company, string]> {
    return await this.companyRepo.markDeleted(key);
  }

  async listAllForTesting(): Promise<Company[]> {
    return await this.companyRepo.listAllForTesting();
  }

  async search(searchDto: SearchDto): Promise<[CompanyFoundDto[], string]> {
    const country = searchDto.country;
    this.searchInboundTotal.inc({ country: country });
    const results = await this.findInRepo(searchDto);
    let found;
    let message;
    if (results.length != 0) {
      this.searchFoundTotal.inc({ country: country, answered_by: 'repo' });
      message = CompanyService.messageCompaniesFoundInRepository;
    } else {
      this.logger.verbose(`Could not find company in the repo; metadata: ${JSON.stringify(searchDto)}`);
      [found, message] = await this.findInScraperService(searchDto);
      if (found.length != 0) {
        this.searchFoundTotal.inc({ country: country, answered_by: 'scrapers' });
      }
      results.push(...found);
    }

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

  private async findInRepo(searchDto: SearchDto): Promise<CompanyFoundDto[]> {
    const results: CompanyFoundDto[] = [];
    if (searchDto.id) {
      const company = await this.companyRepo.findById(searchDto.id);
      if (company) {
        results.push({
          confidence: CompanyService.confidenceById,
          foundBy: 'Repository by id',
          company: company,
        });
      }
    }
    if (searchDto.companyId && searchDto.country) {
      const company = await this.companyRepo.get(searchDto.country, searchDto.companyId);
      if (company) {
        results.push({
          confidence: CompanyService.confidenceByCompanyIdAndCountry,
          foundBy: 'Repository by companyId and country',
          company: company,
        });
      }
    }
    if (searchDto.companyName) {
      results.push(
        ...(await this.companyRepo.findByName(searchDto.companyName)).map(function (company) {
          return {
            confidence: CompanyService.confidenceByName,
            foundBy: 'Repository by name',
            company: company,
          };
        }),
      );
    }
    return results;
  }

  // There are three main error situations when contacting the ScraperService:
  // 1. We cannot contact the ScraperService
  // 2. The ScraperService returns a failure
  // 3. We cannot parse the response
  // Each of these increment `this.findScraperErrorTotal` and throw an HTTPException with
  // a descriptive message.
  private async findInScraperService(searchDto: SearchDto): Promise<[CompanyFoundDto[], string]> {
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
        component: 'scraper_service',
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
      this.searchErrorTotal.inc({ country: country, status_code: response.status, component: 'scraper_service' });
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
          const [company] = await this.insertOrUpdate({ dataSource: scraperName, ...dto.company } as InsertOrUpdateDto);
          this.logger.debug(`Added company: ${JSON.stringify(company)}`);
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
        component: 'scraper_service',
      });
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return [results, message];
  }
}
