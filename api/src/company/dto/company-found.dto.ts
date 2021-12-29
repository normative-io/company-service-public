import { Company } from '../company.model';
import { CreateCompanyDto } from './create-company.dto';

export class CompanyFoundInScraperDto extends CreateCompanyDto { }

export class CompanyFoundInServiceDto extends Company { }
