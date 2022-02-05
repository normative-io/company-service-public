import { ApiProperty } from '@nestjs/swagger';
import { v4 as uuid } from 'uuid';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { isEqual, omit } from 'lodash';

export class Company {
  @ApiProperty({
    type: String,
    description: 'The identifier of the company. Defaults to a randomly generated value',
    example: '123456',
  })
  public id: string;

  @ApiProperty({
    type: String,
    description: 'The name of the company',
    example: 'An awesome company',
  })
  public companyName: string;

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
    description: 'The International Standard Industrial Classification (ISIC) for the company',
    example: '123',
  })
  public isic?: string;

  @ApiProperty({
    type: Date,
    description: 'The date the company was added to the service. Defaults to the current date',
  })
  public created: Date;

  constructor(createCompanyDto: CreateCompanyDto) {
    this.id = uuid();
    this.companyName = createCompanyDto.companyName;
    this.country = createCompanyDto.country;
    this.companyId = createCompanyDto.companyId;
    this.isic = createCompanyDto.isic;
    const now = new Date();
    this.created = now;
  }

  update(updateCompanyDto: UpdateCompanyDto) {
    if (updateCompanyDto.companyName) {
      this.companyName = updateCompanyDto.companyName;
    }
    if (updateCompanyDto.country) {
      this.country = updateCompanyDto.country;
    }
    if (updateCompanyDto.companyId) {
      this.companyId = updateCompanyDto.companyId;
    }
    if (updateCompanyDto.isic) {
      this.isic = updateCompanyDto.isic;
    }
  }

  // Compares whether two Company objects represent the equivalent metadata.
  isMetadataEqual(other: Company): boolean {
    const internalFields = ['id', 'created'];
    return isEqual(omit(this, internalFields), omit(other, internalFields));
  }
}
