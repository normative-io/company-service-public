import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { AxiosRequestConfig } from "axios";
import { CompanyFoundInScraperDto } from "../dto/company-found.dto";
import { FindCompanyDto } from "../dto/find-company.dto";
import { IScraperService } from "./service-interface";
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ScraperService implements IScraperService {

    private readonly logger = new Logger(ScraperService.name);

    constructor(private readonly httpService: HttpService) { }

    async fetchByCompanyId(findCompanyDto: FindCompanyDto): Promise<CompanyFoundInScraperDto[]> {
        const address = 'http://127.0.0.1:3001/scraper/fetch/byCompanyId';
        this.logger.log(`Making fetch/byCompanyId request on ScraperService on ${address}`);

        const requestConfig: AxiosRequestConfig = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const response = await firstValueFrom(
            this.httpService.post(address, findCompanyDto, requestConfig));
        this.logger.verbose(`fetch/byCompanyId got response: ${JSON.stringify(response.data, undefined, 2)}`);

        return response.data.map(function (elem) {
            return {
                confidence: elem.confidence,
                foundBy: elem.scraperName ? `Scraper ${elem.scraperName}` : undefined,
                company: elem,
            };
        });
    }
}
