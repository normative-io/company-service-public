import { ApiProperty } from '@nestjs/swagger';

export class MarkDeletedDto {
  @ApiProperty({
    description: 'The internal identifier for this company',
    example: '12345abcde',
    required: true,
  })
  readonly companyId: string;
}
