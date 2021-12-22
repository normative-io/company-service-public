import { Injectable, NotAcceptableException, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Company } from "./company.model";

@Injectable()
export class InMemoryCompanyService {

    companies: Company[] = [];

    listAll() {
        return [...this.companies];
    }

    add(company: Company): Company {
        const baseCompany = this.newBaseCompany();
        const finalCompany = this.merge(baseCompany, company);
        this.companies.push(finalCompany);
        return finalCompany;
    }

    getById(id: string): Company {
        const [_, company] = this.find(id);
        return company;
    }

    update(id: string, company: Company): Company {
        const [index, existing] = this.find(id);
        const updatedCompany = this.merge(existing, company);
        this.companies[index] = updatedCompany;
        return updatedCompany;
    }

    delete(id: string): number {
        const [index, _] = this.find(id);
        this.companies.splice(index, 1);
        return this.companies.length;
    }

    private find(id: string): [number, Company] {
        if (!id) {
            throw new NotAcceptableException("An id must be specified");
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

    private newBaseCompany(): Company {
        return new Company(randomUUID(), "", new Date());
    }

    private merge(base: Company, updates: Company): Company {
        return new Company(
            // Note that at the moment it's not possible to clear a field with a 'merge' operation;
            // this isn't a big problem because all of the current fields should be present.
            updates.id ? updates.id : base.id,
            updates.name ? updates.name : base.name,
            updates.created ? updates.created : base.created);
    }

    private availableIds(): string[] {
        return this.companies.map(company => company.id);
    }
}
