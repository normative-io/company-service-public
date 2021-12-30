import { Inject, Injectable, Logger } from "@nestjs/common";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";
import { ICompanyService } from "./company-service.interface";
import { Company } from "./company.model";
import { COMPANY_REPOSITORY, ICompanyRepository } from "./repository/repository-interface";
import { FindCompanyDto } from "./dto/find-company.dto";
import { IScraperService, SCRAPER_SERVICE } from "./scraper/service-interface";
import { CompanyFoundInServiceDto } from "./dto/company-found.dto";

@Injectable()
export class CompanyService implements ICompanyService {

    private readonly logger = new Logger(CompanyService.name);

    // These confidence values have been chosen intuitively.
    static readonly confidenceById = 1;
    static readonly confidenceByName = 0.9;

    constructor(
        @Inject(COMPANY_REPOSITORY)
        private readonly companyRepo: ICompanyRepository,
        @Inject(SCRAPER_SERVICE)
        private readonly scraperService: IScraperService,
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
        var results = [];
        if (findCompanyDto.id) {
            const company = this.companyRepo.findById(findCompanyDto.id);
            if (company) {
                results.push({
                    confidence: CompanyService.confidenceById,
                    debugString: 'Repository by id',
                    company: company,
                });
            }
        }
        if (findCompanyDto.name) {
            results.push(...this.companyRepo.findByName(findCompanyDto.name).map(function (company) {
                return {
                    confidence: CompanyService.confidenceByName,
                    debugString: 'Repository by name',
                    company: company,
                }
            }));
        }
        if (results.length === 0) {
            this.logger.verbose(`Could not find company with metadata ${JSON.stringify(findCompanyDto, undefined, 2)} in the repo`);
            // We don't want to contact the scraper service if the request is empty.
            if (Object.keys(findCompanyDto).length != 0) {
                try {
                    const fetched = await this.scraperService.fetchByCompanyId(findCompanyDto);
                    if (fetched) {
                        this.logger.verbose(`Fetched companies: ${JSON.stringify(fetched, undefined, 2)}`);
                        fetched.forEach(companyFoundDto => {
                            const company = this.add(companyFoundDto.company);
                            results.push({
                                ...companyFoundDto,
                                company: company,
                            });
                        });
                    }
                } catch (e) {
                    this.logger.error(`Could not get companies from ScraperService: ${e}`);
                }
            }
        }
        if (results.length === 0) {
            this.logger.verbose(`Could not find company with metadata ${JSON.stringify(findCompanyDto, undefined, 2)} anywhere`);
        }
        return this.rank(results);
    }

    rank(companies: CompanyFoundInServiceDto[]): CompanyFoundInServiceDto[] {
        companies.sort(this.compareByConfidenceDesc);
        return companies.filter(function (elem, index, self) {
            // Keep if this is the first index for this company's id.
            return index === self.findIndex(c => c.company.id === elem.company.id);
        });
    }

    compareByConfidenceDesc(a: CompanyFoundInServiceDto, b: CompanyFoundInServiceDto) {
        if (a.confidence > b.confidence) {
            return -1;
        }
        if (a.confidence < b.confidence) {
            return 1;
        }
        return 0;
    }

}
