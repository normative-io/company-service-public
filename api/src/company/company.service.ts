import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Company } from './company.model';
import { COMPANY_REPOSITORY, ICompanyRepository } from './repository/repository-interface';
import { InsertOrUpdateDto } from './dto/insert-or-update.dto';
import { CompanyFoundDto, ScraperServiceResponse } from './dto/company-found.dto';
import { Counter } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { HttpService } from '@nestjs/axios';
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

  private scraperServiceAddress;

  constructor(
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepo: ICompanyRepository,
    private readonly httpService: HttpService,
    private configService: ConfigService,
    // Some metrics for the "find" operation are related to each other:
    // find_inbound_total = find_outbound_found_in_repo_total + find_outbound_found_in_scrapers_total + find_outbound_not_found_total
    @InjectMetric('find_inbound_total')
    public findInboundTotal: Counter<string>,
    @InjectMetric('find_outbound_found_in_repo_total')
    public findFoundInRepoTotal: Counter<string>,
    @InjectMetric('find_outbound_found_in_scrapers_total')
    public findFoundInScrapersTotal: Counter<string>,
    @InjectMetric('find_outbound_not_found_total')
    public findNotFoundTotal: Counter<string>,
    @InjectMetric('find_scrapers_error_total')
    public findScraperErrorTotal: Counter<string>,
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
  async get(getCompanyDto: GetCompanyDto): Promise<CompanyFoundDto[]> {
    this.logger.verbose(`Looking in repo for company: ${JSON.stringify(getCompanyDto)}`);
    const company = await this.companyRepo.get(getCompanyDto.country, getCompanyDto.companyId, getCompanyDto.atTime);
    if (company) {
      return [
        {
          confidence: CompanyService.confidenceByCompanyIdAndCountry,
          foundBy: 'Repository by companyId and country',
          company: company,
        },
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
    return [];
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

  async search(searchDto: SearchDto): Promise<CompanyFoundDto[]> {
    this.findInboundTotal.inc();
    const results = await this.findInRepo(searchDto);
    if (results.length != 0) {
      this.findFoundInRepoTotal.inc();
    } else {
      this.logger.verbose(`Could not find company in the repo; metadata: ${JSON.stringify(searchDto)}`);
      const found = await this.findInScraperService(searchDto);
      if (found.length != 0) {
        this.findFoundInScrapersTotal.inc();
      }
      results.push(...found);
    }

    if (results.length === 0) {
      this.logger.verbose(`Could not find company anywhere; metadata: ${JSON.stringify(searchDto)}`);
      this.findNotFoundTotal.inc();
    }
    return results
      .sort((a, b) => b.confidence - a.confidence)
      .filter(
        (elem, index, self) =>
          // Keep if this is the first index for this company's id.
          index === self.findIndex((c) => c.company.id === elem.company.id),
      );
  }

  private async findInRepo(searchDto: SearchDto): Promise<CompanyFoundDto[]> {
    const results = [];
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
  private async findInScraperService(searchDto: SearchDto): Promise<CompanyFoundDto[]> {
    if (Object.keys(searchDto).length === 0) {
      throw new HttpException(`Search request cannot be empty`, HttpStatus.BAD_REQUEST);
    }
    const results = [];
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
      this.findScraperErrorTotal.inc();
      throw new HttpException(message, HttpStatus.SERVICE_UNAVAILABLE);
    }
    let jsonResponse = await response.json();
    if (!response.ok) {
      this.logger.debug(`Fetched failed response (status=${response.status}) ${JSON.stringify(jsonResponse)}`);
      // A failed response is of the form:
      // {"statusCode":501,"message":"No suitable scrapers for the request"}
      //
      // TODO: Don't propagate all problems blindly, for instance, we probably don't want to
      // propagate HttpStatus.NOT_IMPLEMENTED or NOT_FOUND exceptions.
      const message = `Request to ScraperService failed: ${jsonResponse.message}`;
      this.logger.error(message);
      this.findScraperErrorTotal.inc();
      throw new HttpException(message, response.status);
    }
    const scraperResponse = jsonResponse as ScraperServiceResponse;
    this.logger.debug(`Fetched response from ScraperService: ${JSON.stringify(scraperResponse)}`);
    return this.toCompanies(scraperResponse);
  }

  private async toCompanies(response: ScraperServiceResponse): Promise<CompanyFoundDto[]> {
    const results = [];
    this.logger.verbose(`Extracting companies from response: ${JSON.stringify(response)}`);
    if (!response.companies) {
      return results;
    }
    try {
      for (const scraperResponse of response.companies) {
        const scraperName = scraperResponse.scraperName;
        this.logger.verbose(`Processing response from scraper ${scraperName}: ${JSON.stringify(scraperResponse)}`);
        for (const dto of scraperResponse.companies) {
          this.logger.debug(`Processing: ${JSON.stringify(dto)}`);
          const [company] = await this.insertOrUpdate(dto.company as InsertOrUpdateDto);
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
      this.findScraperErrorTotal.inc();
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return results;
  }
}
