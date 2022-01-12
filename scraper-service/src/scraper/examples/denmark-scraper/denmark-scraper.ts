import { Logger } from '@nestjs/common';
import { LookupRequest } from '../../../dto/lookup.dto';
import { CheckResult, LookupResponse, FoundCompany, IScraper } from '../../../dto/scraper.interface';
import * as NrRequest from './cvrnr-request.json';
import { DKSicMapping } from './repository/dksicmapping.model';
import { NaceIsicMapping } from '../../common/naceisicmapping.model';
import { VirkResponse } from './response';
import { DKSicMappingRepository } from './repository/dksicmapping.repository';
import { NaceIsicMappingRepository } from '../../common/naceisicmapping.repository';

const URI = 'http://distribution.virk.dk/cvr-permanent/virksomhed/_search';

export class DenmarkScraper implements IScraper {
  private logger = new Logger(DenmarkScraper.name);
  private username: string = process.env.DK_VIRK_USERNAME;
  private password: string = process.env.DK_VIRK_PASSWORD;
  private dkSicMapping = new DKSicMappingRepository();
  private naceIsicMapping = new NaceIsicMappingRepository();

  name() {
    return 'denmark-scraper';
  }

  check(req: LookupRequest): CheckResult {
    if (req.country === 'DK') {
      return { isApplicable: true, priority: 10 };
    }
    return { isApplicable: false };
  }

  async lookup(req: LookupRequest): Promise<LookupResponse> {
    return {
      foundCompanies: await this.fetchRequest(req),
    };
  }

  /*
   Create a request body with a elastic search query to request a company by its CVR number
   (which is the danish term for a tax id) used as a unique identifier. The CVR number is assumed
   to NOT be prefixed with the `DK` country code prefix.
   */
  private requestWithCVRNr(nr: string): string {
    const template = NrRequest;
    template.query.bool.must[0].term['Vrvirksomhed.cvrNummer'] = nr;
    return JSON.stringify(template);
  }

  /*
   Fetch the company data from Virk.
   */
  private async fetchRequest(request: LookupRequest): Promise<FoundCompany[]> {
    const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
    const requestBody = this.requestWithCVRNr(request.companyId);
    this.logger.verbose(`Request body: ${requestBody}`);

    this.logger.debug(`Authorization: Basic ${auth}`);
    try {
      const response = await fetch(URI, {
        method: 'post',
        body: requestBody,
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      const text = await response.text();
      this.logger.debug(`Fetch response length: ${text.length}`);
      const responseBody = JSON.parse(text) as VirkResponse;
      this.logger.debug('Fetch response succesfully parsed');
      return this.toCompanies(request, responseBody);
    } catch (e) {
      this.logger.error(`Error fetching response: ${e}`);
      return [];
    }
  }

  /*
   Convert danish localised `VirkResponse` response data into a generic `FoundCompany` array.
   VirkResponse contains a list of hits, each of which is a company which in turn contains data,
   most of which is in time series.
   */
  async toCompanies(request: LookupRequest, response: VirkResponse): Promise<FoundCompany[]> {
    const companies: FoundCompany[] = [];
    for (const hit of response.hits.hits) {
      const names = hit._source.Vrvirksomhed.navne.filter(this.validPeriod).map((name) => name.navn);
      this.logger.debug(`Found names: ${names}`);
      if (names.length == 0) {
        // Companies without names are probably invalid and will not be returned
        continue;
      }
      // Names are returned in chronological order, the latest is the current
      const name = names.pop();
      const taxID = hit._source.Vrvirksomhed.cvrNummer.toString();
      this.logger.debug(`Found tax id: ${taxID}`);
      /*
       Get the localised SIC for the company. Assume that localised SICs 
       (branchekode) are ordered from most to least important and return the
       first valid SIC. The list is a time series list and is filtered to remove
       any invalid SICs.
      */
      const localizedSic = hit._source.Vrvirksomhed.hovedbranche
        .filter(this.validPeriod)
        .map((classification) => classification.branchekode.toString())
        .shift();
      this.logger.debug(`Found localizedSic: ${localizedSic}`);

      try {
        const nace = await this.toNACE(localizedSic);
        this.logger.debug(`Found nace: ${nace}`);
        let isicV4: string;
        if (nace) {
          const mapping = await this.toISIC(nace);
          isicV4 = mapping.isic;
        } else {
          // Companies without ISICs are not useful and will not be returned
          this.logger.warn(`No nace found for sic: ${localizedSic}`);
          continue;
        }

        const company = new FoundCompany(1.0, name, isicV4, taxID);

        companies.push(company);
        this.logger.debug(`Added ${JSON.stringify(company)} to list of companies`);
      } catch (error) {
        this.logger.error(`Error fetching isic: ${error}`);
      }
    }
    return companies;
  }

  /*
   Filter function for a time series list of properties and remove any property
   which has a end date set for its validity, assuming that the end date is
   always either in the past or unset.
   */
  private validPeriod(hasPeriod: any): boolean {
    return hasPeriod.periode.gyldigTil === null;
  }

  private async toNACE(sic: string): Promise<string> {
    const mappings: DKSicMapping[] = await this.dkSicMapping.findByDkSic(sic);
    return mappings.pop().nace;
  }

  private async toISIC(nace: string): Promise<NaceIsicMapping> {
    return await this.naceIsicMapping.findByNace(nace);
  }
}
