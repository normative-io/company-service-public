import { ApiProperty } from '@nestjs/swagger';

export class Company {

    @ApiProperty({
        type: String,
        description: 'The identifier of the company. Defaults to a randomly generated value',
        example: '123456'
    })
    public id?: string
    @ApiProperty({
        type: String,
        description: 'The name of the company',
        example: 'An awesome company'
    })
    public name?: string
    @ApiProperty({
        type: Date,
        description: 'The date the company was added to the service. Defaults to the current date'
    })
    public created?: Date

    constructor(id: string, name: string, created: Date) {
        this.id = id;
        this.name = name;
        this.created = created;
    }
}
