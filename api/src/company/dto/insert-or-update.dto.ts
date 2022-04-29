// Copyright 2022 Meta Mind AB
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
import { ApiProperty } from '@nestjs/swagger';

export class InsertOrUpdateDto {
  @ApiProperty({
    description: 'The country code that this company is registered in.',
    example: 'CH',
    required: true,
  })
  readonly country: string;

  @ApiProperty({
    description: 'The name of the company',
    example: 'An awesome company',
    required: false,
  })
  readonly companyName?: string;

  @ApiProperty({
    description: 'Where this company metadata was sourced from.',
    example: 'Denmark Registry',
    required: false,
  })
  readonly dataSource?: string;

  @ApiProperty({
    description: 'The International Standard Industrial Classification (ISIC) for the company',
    example: '123',
    required: false,
  })
  readonly isic?: string;

  @ApiProperty({
    description: 'The Tax ID for the company',
    example: '123',
    required: false,
  })
  public taxId?: string;

  @ApiProperty({
    description: 'The organization number',
    example: '123',
    required: false,
  })
  public orgNbr?: string;
}
