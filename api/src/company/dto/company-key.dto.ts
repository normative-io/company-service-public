import { ApiProperty } from '@nestjs/swagger';

// A client-centric way of referring to a specific company.
export class CompanyKeyDto {
  @ApiProperty({
    description: 'The country code that this company is registered in.',
    example: 'CH',
    required: true,
  })
  readonly country: string;

  @ApiProperty({
    description: 'The identifier for the company (ex: VAT, EIN, etc..)',
    example: '123',
    required: true,
  })
  readonly companyId: string;
}
