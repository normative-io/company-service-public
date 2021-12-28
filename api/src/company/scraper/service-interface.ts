import { CompanyFoundInScraperDto } from "../dto/company-found.dto";
import { FindCompanyDto } from "../dto/find-company.dto";

export const SCRAPER_SERVICE = 'SCRAPER_SERVICE';

export interface IScraperService {
    fetchByCompanyId(findCompanyDto: FindCompanyDto): CompanyFoundInScraperDto[];
}
