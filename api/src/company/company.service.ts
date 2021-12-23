import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";
import { ICompanyService } from "./company-service.interface";
import { Company } from "./company.model";
import { COMPANY_REPOSITORY, ICompanyRepository } from "./repository/repository-interface";
import { FindCompanyDto } from "./dto/find-company.dto";

@Injectable()
export class CompanyService implements ICompanyService {

    constructor(
        @Inject(COMPANY_REPOSITORY)
        private readonly companyRepo: ICompanyRepository
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
        var deduped = results.filter(function (elem, index, self) {
            return index === self.indexOf(elem);
        })
        if (!deduped) {
            console.log(`Could not find company with metadata ${JSON.stringify(findCompanyDto, undefined, 2)}`);
        }
        return deduped;
    }

}
