import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { FetchByCompanyIdDto } from 'src/dto/fetch.dto';
import { DenmarkScraper } from '.';
import * as response from './denmark-scraper.spec.response.json';

describe('DenmarkScraper', () => {
  let scraper: DenmarkScraper;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      controllers: [],
      providers: [DenmarkScraper],
    }).compile();

    scraper = app.get<DenmarkScraper>(DenmarkScraper);
  });

  it('should convert a VirkResponse to a FoundCompany', async () => {
    const request: FetchByCompanyIdDto = {
      country: 'DK',
      companyId: '37018848',
    };
    // @ts-expect-error: Response type is complex and may differ slightly
    expect(await scraper.toCompanies(request, response)).toEqual([
      {
        confidence: 1.0,
        name: 'Meta Mind AB',
        isic: '6201',
        orgNr: '37018848',
      },
    ]);
  });
});
