import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { Company } from "../company.model";
import { CreateCompanyDto } from "../dto/create-company.dto";
import { UpdateCompanyDto } from "../dto/update-company.dto";
import { ICompanyService } from "../company-service.interface";

/** 
 * A CompanyService that keeps all data in memory. 
 * 
 * Useful for testing and development.
 * */
@Injectable()
export class InMemoryCompanyService implements ICompanyService {

    companies: Company[] = [];

    listAll() {
        return [...this.companies];
    }

    add(createCompanyDto: CreateCompanyDto): Company {
        const company = new Company(createCompanyDto);
        this.companies.push(company);
        return company;
    }

    getById(id: string): Company {
        const [_, company] = this.findById(id);
        return company;
    }

    update(id: string, updateCompanyDto: UpdateCompanyDto): Company {
        const [_, existing] = this.findById(id);
        existing.update(updateCompanyDto);
        return existing;
    }

    delete(id: string): number {
        const [index, _] = this.findById(id);
        this.companies.splice(index, 1);
        return this.companies.length;
    }

    private findById(id: string): [number, Company] {
        if (!id) {
            throw new UnprocessableEntityException("An id must be specified");
        }
        const index = this.companies.findIndex(company => company.id === id);
        const company = this.companies[index];
        if (!company) {
            const msg = `Could not find company with id ${id}; available ids: ${this.availableIds()}`;
            console.log(msg);
            throw new NotFoundException(msg);
        }
        return [index, company];
    }

    private availableIds(): string[] {
        return this.companies.map(company => company.id);
    }
}
