import { FetchByCompanyIdDto } from 'src/dto/fetch.dto';
import { CheckResult, FetchResult, IScraper } from 'src/dto/scraper.interface';

export class DenmarkScraper implements IScraper {
  name() {
    return 'denmark-scraper';
  }

  check(req: FetchByCompanyIdDto): CheckResult {
    if (req.country === 'DK') {
      return { isApplicable: true, priority: 10 };
    }
    return { isApplicable: false };
  }

  fetch(req: FetchByCompanyIdDto): FetchResult {
    return {
      foundCompanies: [
        { confidence: 1.0, name: `danish-company-${req.companyId}` },
      ],
    };
  }
}
