import { ApiProperty } from '@nestjs/swagger';

// TODO: make SearchDto more flexible and support more complex filtering.
export class SearchDto {
  @ApiProperty({
    description: 'The country code that this company is registered in.',
    example: 'CH',
    required: false,
  })
  readonly country?: string;

  @ApiProperty({
    description: 'The identifier for the company (ex: VAT, EIN, etc..)',
    example: '123',
    required: false,
  })
  readonly companyId?: string;

  // Note: `atTime` represents the database-insertion time of the record and not any
  // business-related timestamp (ex: date which the company was founded or dissolved).
  @ApiProperty({
    description: 'Timestamp version of the company in the database. If null, will get the latest version.',
    example: Date.now(),
    required: false,
  })
  readonly atTime?: Date;

  @ApiProperty({
    description: 'The name of the company',
    example: 'An awesome company',
    required: false,
  })
  readonly companyName?: string;

  @ApiProperty({
    description: 'The International Standard Industrial Classification (ISIC) for the company',
    example: '123',
    required: false,
  })
  readonly isic?: string;
}
