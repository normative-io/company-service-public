import { ApiProperty } from '@nestjs/swagger';
import { randomUUID } from "crypto";
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

export class Company {

    @ApiProperty({
        type: String,
        description: 'The identifier of the company. Defaults to a randomly generated value',
        example: '123456'
    })
    readonly id: string

    @ApiProperty({
        type: String,
        description: 'The name of the company',
        example: 'An awesome company'
    })
    public name: string

    @ApiProperty({
        type: Date,
        description: 'The date the company was added to the service. Defaults to the current date'
    })
    readonly created: Date

    constructor(createCompanyDto: CreateCompanyDto) {
        this.id = randomUUID();
        this.name = createCompanyDto.name;
        const now = new Date();
        this.created = now;
    }

    update(company: UpdateCompanyDto) {
        if (company.name) { this.name = company.name };
    }
}
