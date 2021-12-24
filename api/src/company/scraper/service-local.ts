import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { CreateCompanyDto } from "../dto/create-company.dto";
import { FindCompanyDto } from "../dto/find-company.dto";
import { IScraperService } from "./service-interface";

/** 
 * A IScraperService for development and testing.
 * 
 * LocalScraperService always finds a match.
 * */
@Injectable()
export class LocalScraperService implements IScraperService {

    fetchByCompanyId(findCompanyDto: FindCompanyDto): CreateCompanyDto[] {
        // Simply pretend we've found a company.
        const name = findCompanyDto.name ? `${findCompanyDto.name} - fetched` : 'Dummy company name';
        return [{
            name: name,
            ...findCompanyDto,
        }];
    }

}
