import { ApiProperty } from '@nestjs/swagger';

export class InsertOrUpdateDto {
  @ApiProperty({
    description: 'The country code that this company is registered in.',
    example: 'CH',
    required: true,
  })
  readonly country: string;

  @ApiProperty({
    description: 'The name of the company',
    example: 'An awesome company',
    required: false,
  })
  readonly companyName?: string;

  @ApiProperty({
    description: 'Where this company metadata was sourced from.',
    example: 'Denmark Registry',
    required: false,
  })
  readonly dataSource?: string;

  @ApiProperty({
    description: 'The International Standard Industrial Classification (ISIC) for the company',
    example: '123',
    required: false,
  })
  readonly isic?: string;

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
}
