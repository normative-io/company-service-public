import { ApiProperty } from '@nestjs/swagger';

export class FindCompanyDto {

    @ApiProperty({
        type: String,
        description: 'The identifier of the company',
        example: '123456'
    })
    readonly id?: string

    @ApiProperty({
        description: 'The name of the company',
        example: 'An awesome company'
    })
    readonly name?: string
}
