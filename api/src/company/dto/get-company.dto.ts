import { ApiProperty } from '@nestjs/swagger';
import { CompanyKeyDto } from './company-key.dto';

export class GetCompanyDto extends CompanyKeyDto {
  @ApiProperty({
    description: 'Timestamp version of the company. If null, will get the latest version.',
    example: Date.now(),
    required: false,
  })
  readonly atTime?: Date;
}
