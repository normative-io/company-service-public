import { ApiProperty } from '@nestjs/swagger';
import { Company } from '../company.model';
import { CreateCompanyDto } from './create-company.dto';

class CompanyFoundDto {

    @ApiProperty({
        type: String,
        description: 'Information about how this company was found, for debugging',
        example: 'In the repository'
    })
    readonly debugString?: string

    @ApiProperty({
        type: Number,
        description: 'A percentage value (as a value between 0.0 and 1.0) of how confident this data matches the request.',
        example: 0.5
    })
    readonly confidence?: number

}

export class CompanyFoundInScraperDto extends CompanyFoundDto {

    @ApiProperty({
        type: Company,
        description: 'Metadata about the company'
    })
    readonly company: CreateCompanyDto

}

export class CompanyFoundInRepositoryDto extends CompanyFoundDto {

    @ApiProperty({
        type: Company,
        description: 'The company'
    })
    readonly company: Company

}

export class CompanyFoundInServiceDto extends CompanyFoundInRepositoryDto { }
