import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { AxiosRequestConfig } from "axios";
import { CompanyFoundInScraperDto } from "../dto/company-found.dto";
import { FindCompanyDto } from "../dto/find-company.dto";
import { IScraperService } from "./service-interface";

@Injectable()
export class ScraperService implements IScraperService {

    private readonly logger = new Logger(ScraperService.name);

    constructor(private readonly httpService: HttpService) { }

    async fetchByCompanyId(findCompanyDto: FindCompanyDto): Promise<CompanyFoundInScraperDto[]> {
        const address = 'http://127.0.0.1:3001/scraper/fetch/byCompanyId';
        this.logger.log(`Making request to ${address}`);

        const requestConfig: AxiosRequestConfig = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        try {
            // TODO: Find a different way to do this request. toPromise() is deprecated.
            const response = await this.httpService.post(address, findCompanyDto, requestConfig).toPromise();
            this.logger.log(`Response: ${JSON.stringify(response.data, undefined, 2)}`);

            return response.data.map(function (elem) {
                return {
                    confidence: elem.confidence,
                    debugString: 'From ScraperService',
                    company: elem,
                };
            });
        } catch (e) {
            this.logger.error(`${e}. Make sure the Scraper Service is listening on ${address}`);
        }
    }
}
