import { Body, Controller, Delete, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InsertOrUpdateDto } from './dto/insert-or-update.dto';
import { GetCompanyDto } from './dto/get-company.dto';
import { MarkDeletedDto } from './dto/mark-deleted.dto';
import { SearchDto } from './dto/search.dto';
import { CompanyService } from './company.service';

@ApiTags('company')
@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post('v1/get')
  @ApiOperation({ summary: 'Get the historical metadata of the requested company.' })
  @ApiResponse({ description: 'The metadata of the found company. May be multiple if the data had to be scraped.' })
  @ApiBody({ type: GetCompanyDto, description: 'The requested company.' })
  async get(@Body() getCompanyDto: GetCompanyDto) {
    return { companies: await this.companyService.get(getCompanyDto) };
  }

  @Post('v1/insertOrUpdate')
  @ApiOperation({ summary: 'Add/update metadata of the specified companies.' })
  @ApiResponse({ description: 'The metadata of the new/updated companies.' })
  @ApiBody({ type: [InsertOrUpdateDto], description: 'The new/updated companies.' })
  async insertOrUpdate(@Body() insertOrUpdateDtos: InsertOrUpdateDto[]) {
    // Note: this currently requires all insertOrUpdates to succeed for the HTTP request to succeed.
    // If any operation fails, the request fails fast and the remaining operations will not attempt to finish.
    // We likely want to change this in the future to return any error messages per-operation.
    return (await Promise.all(insertOrUpdateDtos.map((dto) => this.companyService.insertOrUpdate(dto)))).map(
      ([company, message]) => ({ company, message }),
    );
  }

  @Delete('v1/markDeleted')
  @ApiOperation({ summary: 'Mark a company as deleted.' })
  @ApiBody({ type: MarkDeletedDto, description: 'The company to delete.' })
  @HttpCode(204)
  async markDeleted(@Body() markDeletedDto: MarkDeletedDto) {
    const [company, message] = await this.companyService.markDeleted(markDeletedDto);
    return { company, message };
  }

  @Post('v1/search')
  @ApiOperation({ summary: 'Find companies by metadata.' })
  @ApiResponse({ description: 'The matching companies.' })
  @ApiBody({
    type: SearchDto,
    description: 'The fields to look for; companies matching any field will be returned.',
  })
  async search(@Body() searchDto: SearchDto) {
    return [...(await this.companyService.search(searchDto))];
  }
}
