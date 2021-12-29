import { Injectable } from "@nestjs/common";
import { CompanyFoundInScraperDto } from "../dto/company-found.dto";
import { FindCompanyDto } from "../dto/find-company.dto";
import { IScraperService } from "./service-interface";

/** 
 * A IScraperService for development and testing.
 * 
 * LocalScraperService always finds a match.
 * */
@Injectable()
export class LocalScraperService implements IScraperService {

    fetchByCompanyId(findCompanyDto: FindCompanyDto): CompanyFoundInScraperDto[] {
        // Simply pretend we've found a company.
        const name = findCompanyDto.name ? `${findCompanyDto.name} - fetched` : 'Dummy company name';
        return [{
            confidence: 0.1,
            debugString: 'LocalScraperService',
            company: {
                ...findCompanyDto,
                name: name,
            }
        }];
    }

}
