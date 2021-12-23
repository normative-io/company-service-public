import { Company } from "../company.model";

export const COMPANY_REPOSITORY = 'COMPANY_REPOSITORY';

export interface ICompanyRepository {
    exists(company: Company): boolean;
    save(company: Company): Company;
    listAll(): Company[];
    getById(id: string): Company;
    delete(id: string);
    findById(id: string): Company;
    findByName(name: string): Company[];
}
