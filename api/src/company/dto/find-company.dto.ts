import { ApiProperty } from '@nestjs/swagger';
import { CreateCompanyDto } from './create-company.dto';

export class FindCompanyDto extends CreateCompanyDto {
  @ApiProperty({
    type: String,
    description: 'The identifier of the company',
    example: '123456',
  })
  readonly id?: string;
}
