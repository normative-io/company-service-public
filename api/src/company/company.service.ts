import { Inject, Injectable, Logger } from "@nestjs/common";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";
import { ICompanyService } from "./company-service.interface";
import { Company } from "./company.model";
import { COMPANY_REPOSITORY, ICompanyRepository } from "./repository/repository-interface";
import { FindCompanyDto } from "./dto/find-company.dto";
import { CompanyFoundInServiceDto } from "./dto/company-found.dto";
import { Counter } from "prom-client";
import { InjectMetric } from "@willsoto/nestjs-prometheus";
import { HttpService } from "@nestjs/axios";
import { AxiosRequestConfig } from "axios";
import { firstValueFrom } from "rxjs";

@Injectable()
export class CompanyService implements ICompanyService {

    static readonly scraperServiceAddress = 'http://127.0.0.1:3001/scraper/fetch/byCompanyId';

    static readonly requestConfig: AxiosRequestConfig = {
        headers: { 'Content-Type': 'application/json' },
    };

    private readonly logger = new Logger(CompanyService.name);

    // These confidence values have been chosen intuitively.
    static readonly confidenceById = 1;
    static readonly confidenceByName = 0.9;

    constructor(
        @Inject(COMPANY_REPOSITORY)
        private readonly companyRepo: ICompanyRepository,
        private readonly httpService: HttpService,
        // Some metrics for the "find" operation are related to each other:
        // find_inbound_total = find_outbound_found_in_repo_total + find_outbound_found_in_scrapers_total + find_outbound_not_found_total
        @InjectMetric("find_inbound_total")
        public findInboundTotal: Counter<string>,
        @InjectMetric("find_outbound_found_in_repo_total")
        public findFoundInRepoTotal: Counter<string>,
        @InjectMetric("find_outbound_found_in_scrapers_total")
        public findFoundInScrapersTotal: Counter<string>,
        @InjectMetric("find_outbound_not_found_total")
        public findNotFoundTotal: Counter<string>,
        @InjectMetric("find_scrapers_error_total")
        public findScraperErrorTotal: Counter<string>,
    ) { }

    listAll() {
        const all = this.companyRepo.listAll();
        return [...all];
    }

    add(createCompanyDto: CreateCompanyDto): Company {
        const company = new Company(createCompanyDto);
        this.companyRepo.save(company);
        return company;
    }

    getById(id: string): Company {
        return this.companyRepo.getById(id);
    }

    update(id: string, updateCompanyDto: UpdateCompanyDto): Company {
        const company = this.companyRepo.getById(id);
        company.update(updateCompanyDto);
        this.companyRepo.save(company);
        return company;
    }

    delete(id: string) {
        this.companyRepo.delete(id);
    }

    async find(findCompanyDto: FindCompanyDto): Promise<CompanyFoundInServiceDto[]> {
        this.findInboundTotal.inc();
        var results = this.findInRepo(findCompanyDto);
        if (results.length != 0) {
            this.findFoundInRepoTotal.inc();
        } else {
            this.logger.verbose(`Could not find company in the repo; metadata: ${JSON.stringify(findCompanyDto, undefined, 2)}`);
            const found = await this.findInScraperService(findCompanyDto);
            if (found.length != 0) {
                this.findFoundInScrapersTotal.inc();
            }
            results.push(...found);
        }

        if (results.length === 0) {
            this.logger.verbose(`Could not find company anywhere; metadata: ${JSON.stringify(findCompanyDto, undefined, 2)}`);
            this.findNotFoundTotal.inc();
        }
        return results
            .sort((a, b) => b.confidence - a.confidence)
            .filter((elem, index, self) =>
                // Keep if this is the first index for this company's id.
                index === self.findIndex(c => c.company.id === elem.company.id)
            );
    }

    private findInRepo(findCompanyDto: FindCompanyDto): CompanyFoundInServiceDto[] {
        var results = [];
        if (findCompanyDto.id) {
            const company = this.companyRepo.findById(findCompanyDto.id);
            if (company) {
                results.push({
                    confidence: CompanyService.confidenceById,
                    foundBy: 'Repository by id',
                    company: company,
                });
            }
        }
        if (findCompanyDto.name) {
            results.push(...this.companyRepo.findByName(findCompanyDto.name).map(function (company) {
                return {
                    confidence: CompanyService.confidenceByName,
                    foundBy: 'Repository by name',
                    company: company,
                }
            }));
        }
        return results;
    }

    private async findInScraperService(findCompanyDto: FindCompanyDto): Promise<CompanyFoundInServiceDto[]> {
        // We don't want to contact the scraper service if the request is empty.
        if (Object.keys(findCompanyDto).length === 0) {
            return [];
        }
        var results = [];
        try {
            const response = await firstValueFrom(
                this.httpService.post(CompanyService.scraperServiceAddress, findCompanyDto, CompanyService.requestConfig));
            this.logger.verbose(`fetch/byCompanyId got response: ${JSON.stringify(response.data, undefined, 2)}`);

            response.data.forEach((dto) => {
                const company = this.add(dto);
                results.push({
                    company: company,
                    confidence: dto.confidence,
                    foundBy: dto.scraperName ? `Scraper ${dto.scraperName}` : undefined,
                });
            });
        } catch (e) {
            this.logger.error(`Could not get companies from ScraperService: ${e}`);
            this.findScraperErrorTotal.inc();
            // Throw the error, so that the request fails - otherwise we might miss
            // the fact that something went wrong.
            throw e;
        }
        return results;
    }

}
