import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { Company } from "../company.model";
import { ICompanyRepository } from "./repository-interface";

/** 
 * A ICompanyRepository that keeps all data in memory. 
 * 
 * Useful for testing and development.
 * */
@Injectable()
export class CompanyRepositoryArray implements ICompanyRepository {

    companies: Company[] = [];

    exists(company: Company): boolean {
        return this.companies.find(c => c.id === company.id) != null;
    }

    save(company: Company): Company {
        if (!this.exists(company)) {
            this.companies.push(company);
        } else {
            const [index, _] = this.findByIdOrThrow(company.id);
            this.companies[index] = company;
        }
        return company;
    }

    listAll(): Company[] {
        return [...this.companies];
    }

    getById(id: string): Company {
        const [_, company] = this.findByIdOrThrow(id);
        return company;
    }

    delete(id: string) {
        const [index, _] = this.findByIdOrThrow(id);
        this.companies.splice(index, 1);
        return this.companies.length;
    }

    findById(id: string): Company {
        return this.companies.find(company => company.id === id);
    }

    findByName(name: string): Company[] {
        return this.companies.filter(company => company.name === name);
    }

    private findByIdOrThrow(id: string): [number, Company] {
        if (!id) {
            throw new UnprocessableEntityException("An id must be specified");
        }
        const index = this.companies.findIndex(company => company.id === id);
        const company = this.companies[index];
        if (!company) {
            const msg = `Could not find company with id '${id}'`;
            console.log(msg);
            console.log(this.allCompaniesString());
            throw new NotFoundException(msg);
        }
        return [index, company];
    }

    private allCompaniesString(): string {
        return `Available companies: ${JSON.stringify(this.listAll(), undefined, 2)}`
    }

}