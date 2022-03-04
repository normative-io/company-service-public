import { ApiProperty } from '@nestjs/swagger';

export class SearchDto {
  @ApiProperty({
    description: 'The country code that this company is registered in.',
    example: 'CH',
    required: false,
  })
  readonly country?: string;

  @ApiProperty({
    description: 'The Tax ID for the company',
    example: '123',
    required: false,
  })
  public taxId?: string;

  @ApiProperty({
    description: 'The organization number',
    example: '123',
    required: false,
  })
  public orgNbr?: string;

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
}
