import { ApiProperty } from '@nestjs/swagger';

export class FetchByCompanyIdDto {
  @ApiProperty({
    description: 'The country code that this company is registered in.',
    example: 'CH',
  })
  readonly country: string;

  @ApiProperty({
    description: 'The identifier for the company (ex: VAT, EIN, etc..)',
    example: '123',
  })
  readonly companyId: string;
}