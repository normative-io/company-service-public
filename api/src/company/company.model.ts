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
        description: 'The country code that this company is registered in.',
        example: 'CH',
    })
    public country?: string;

    @ApiProperty({
        description: 'The identifier for the company (ex: VAT, EIN, etc..)',
        example: '123',
    })
    public companyId?: string;

    @ApiProperty({
        type: Date,
        description: 'The date the company was added to the service. Defaults to the current date'
    })
    readonly created: Date

    constructor(createCompanyDto: CreateCompanyDto) {
        this.id = randomUUID();
        this.name = createCompanyDto.name;
        this.country = createCompanyDto.country;
        this.companyId = createCompanyDto.companyId;
        const now = new Date();
        this.created = now;
    }

    update(updateCompanyDto: UpdateCompanyDto) {
        if (updateCompanyDto.name) { this.name = updateCompanyDto.name };
        if (updateCompanyDto.country) { this.country = updateCompanyDto.country };
        if (updateCompanyDto.companyId) { this.companyId = updateCompanyDto.companyId };
    }
}
