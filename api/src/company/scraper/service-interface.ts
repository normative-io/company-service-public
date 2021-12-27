import { CreateCompanyDto } from "../dto/create-company.dto";
import { FindCompanyDto } from "../dto/find-company.dto";

export const SCRAPER_SERVICE = 'SCRAPER_SERVICE';

export interface IScraperService {
    // TODO: Change the return value to add metadata about how the companies were found, scoring, etc..
    fetchByCompanyId(findCompanyDto: FindCompanyDto): CreateCompanyDto[];
}
