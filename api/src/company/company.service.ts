import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";
import { ICompanyService } from "./company-service.interface";
import { Company } from "./company.model";
import { COMPANY_REPOSITORY, ICompanyRepository } from "./repository/repository-interface";
import { FindCompanyDto } from "./dto/find-company.dto";
import { IScraperService, SCRAPER_SERVICE } from "./scraper/service-interface";

@Injectable()
export class CompanyService implements ICompanyService {

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

    find(findCompanyDto: FindCompanyDto): Company[] {
        var results = [];
        if (findCompanyDto.id) {
            const company = this.companyRepo.findById(findCompanyDto.id);
            if (company) {
                results.push(company);
            }
        }
        if (findCompanyDto.name) {
            results.push(...this.companyRepo.findByName(findCompanyDto.name));
        }
        if (results.length === 0) {
            console.log(`Could not find company with metadata ${JSON.stringify(findCompanyDto, undefined, 2)} in the repo`);
            // We don't want to contact the scraper service if the request is empty.
            if (Object.keys(findCompanyDto).length != 0) {
                console.log(`Contacting ScraperService`);
                const fetched = this.scraperService.fetchByCompanyId(findCompanyDto);
                console.log(`Fetched companies: ${JSON.stringify(fetched, undefined, 2)}`);
                fetched.forEach(createCompanyDto => {
                    const company = this.add(createCompanyDto);
                    results.push(company);
                });
            }
        }
        if (results.length === 0) {
            console.log(`Could not find company with metadata ${JSON.stringify(findCompanyDto, undefined, 2)} anywhere`);
        }
        return results.filter(function (elem, index, self) {
            return index === self.indexOf(elem);
        }); // Dedup before returning.
    }

}
