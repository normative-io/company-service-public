import { ApiProperty } from '@nestjs/swagger';

export class CreateCompanyDto {

    @ApiProperty({
        description: 'The name of the company',
        example: 'An awesome company'
    })
    readonly name: string

}
