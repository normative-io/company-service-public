import { ApiProperty } from '@nestjs/swagger';
import { CompanyKeyDto } from './company-key.dto';

export class InsertOrUpdateDto extends CompanyKeyDto {
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
}
