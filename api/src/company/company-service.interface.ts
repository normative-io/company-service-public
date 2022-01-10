import { Company } from './company.model';
import { CompanyFoundInServiceDto } from './dto/company-found.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { FindCompanyDto } from './dto/find-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

export const COMPANY_SERVICE = 'COMPANY_SERVICE';

export interface ICompanyService {
  add(createCompanyDto: CreateCompanyDto): Promise<Company>;
  addMany(createCompanyDtos: CreateCompanyDto[]): Promise<Company[]>;
  // TODO: Reconsider the 'listAll' operation once we can connect to a real database or system.
  // Returning a million companies won't be useful or practical.
  listAll(): Promise<Company[]>;
  getById(id: string): Promise<Company | undefined>;
  update(id: string, updateCompanyDto: UpdateCompanyDto): Promise<Company>;
  // Delete a company identified by id
  // Returns the number of remaining companies
  delete(id: string): Promise<number>;
  find(findCompanyDto: FindCompanyDto): Promise<CompanyFoundInServiceDto[]>;
}
