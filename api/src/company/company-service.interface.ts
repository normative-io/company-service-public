import { Company } from "./company.model";
import { CompanyFoundInServiceDto } from "./dto/company-found.dto";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { FindCompanyDto } from "./dto/find-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";

export const COMPANY_SERVICE = 'COMPANY_SERVICE';

export interface ICompanyService {
    add(createCompanyDto: CreateCompanyDto): Company;
    // TODO: Reconsider the 'listAll' operation once we can connect to a real database or system. 
    // Returning a million companies won't be useful or practical.
    listAll(): Company[];
    getById(id: string): Company;
    update(id: string, updateCompanyDto: UpdateCompanyDto);
    delete(id: string);
    find(findCompanyDto: FindCompanyDto): Promise<CompanyFoundInServiceDto[]>;
}
