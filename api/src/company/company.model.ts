import { ApiProperty } from '@nestjs/swagger';
import { v4 as uuid } from 'uuid';
import { isEqual, omit } from 'lodash';
import { InsertOrUpdateDto } from './dto/insert-or-update.dto';

// A Company represents a record of the state of a commercial entity at a given point in time.
//
// There are two internal identifiers that are generated by the system and are
// important for a Company object:
// - `id` is globally unique: different Company objects will always have different values.
// - `companyId` groups different Company objects together as belonging to the same commercial entity.
//
// The list of statuses of a commercial entity over time will be a list of Company objects
// that share the same `companyId`.
export class Company {
  // Use `newId()` to generate.
  @ApiProperty({
    type: String,
    description: 'The internal identifier of this record. Defaults to a randomly generated value',
    example: '123456',
  })
  public id: string;

  @ApiProperty({
    type: Boolean,
    description: 'If true, this company record was marked as deleted',
  })
  public isDeleted?: boolean;

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

  // Use `newCompanyId()` to generate.
  @ApiProperty({
    description:
      'The internal identifier of the commercial entity this record belongs to. Defaults to a randomly generated value',
    example: '12345abcde',
  })
  public companyId: string;

  @ApiProperty({
    description: 'The Tax ID for the company',
    example: '123',
  })
  public taxId?: string;

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

  @ApiProperty({
    type: Date,
    description: "The most recent date this company's metadata was changed or verified.",
  })
  public lastUpdated: Date;

  @ApiProperty({
    type: String,
    description: 'Where this company metadata was sourced from.',
  })
  readonly dataSource?: string;

  constructor(insertOrUpdateDto: InsertOrUpdateDto, companyId: string) {
    this.companyId = companyId;

    this.id = Company.newId();
    this.companyName = insertOrUpdateDto.companyName;
    this.country = insertOrUpdateDto.country;
    this.taxId = insertOrUpdateDto.taxId;
    this.isic = insertOrUpdateDto.isic;
    this.dataSource = insertOrUpdateDto.dataSource;
    const now = new Date();
    this.created = now;
    this.lastUpdated = now;
  }

  private static newId(): string {
    return uuid();
  }

  static newCompanyId(): string {
    return uuid();
  }

  // Compares whether two Company objects represent the equivalent metadata.
  isMetadataEqual(other: Company): boolean {
    const internalFields = ['id', 'created', 'lastUpdated'];
    return isEqual(omit(this, internalFields), omit(other, internalFields));
  }
}
