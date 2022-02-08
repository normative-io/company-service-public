import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateCompanyDto } from './dto/create-company.dto';
import { FindCompanyDto } from './dto/find-company.dto';
import { InsertOrUpdateDto } from './dto/insert-or-update.dto';
import { GetCompanyDto } from './dto/get-company.dto';
import { MarkDeletedDto } from './dto/mark-deleted.dto';
import { SearchDto } from './dto/search.dto';
import { CompanyService } from './company.service';

@ApiTags('company')
@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get('v1')
  @ApiOperation({ summary: 'Look up metadata for a company.' })
  @ApiResponse({ description: 'The metadata of the matching company.' })
  v1() {
    return { description: 'example-company' };
  }

  @Post('v1/get')
  @ApiOperation({ summary: 'Get the historical metadata of the requested company.' })
  @ApiResponse({ description: 'The metadata of the found company. May be multiple if the data had to be scraped.' })
  @ApiBody({ type: GetCompanyDto, description: 'The requested company.' })
  async get(@Body() getCompanyDto: GetCompanyDto) {
    return { companies: await this.companyService.get(getCompanyDto) };
  }

  @Post('v1/insertOrUpdate')
  @ApiOperation({ summary: 'Add/update metadata about the specified company.' })
  @ApiResponse({ description: 'The metadata of the new/updated company.' })
  @ApiBody({ type: InsertOrUpdateDto, description: 'The new/updated company.' })
  async insertOrUpdate(@Body() insertOrUpdateDto: InsertOrUpdateDto) {
    const [company, message] = await this.companyService.insertOrUpdate(insertOrUpdateDto);
    return { company, message };
  }

  @Post('v1/insertOrUpdateBulk')
  @ApiOperation({ summary: 'Add/update metdata of many companies.' })
  @ApiResponse({ description: 'The metadata of the new/updated companies.' })
  @ApiBody({ type: [InsertOrUpdateDto], description: 'The new/updated companies.' })
  async insertOrUpdateBulk(@Body() insertOrUpdateDtos: InsertOrUpdateDto[]) {
    // TODO: implement.
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
    // TODO: implement.
  }

  @Post('v1/addMany')
  @ApiOperation({ summary: 'Add many companies.' })
  @ApiResponse({ description: 'The new companies, including any initialised fields.' })
  @ApiBody({ type: [CreateCompanyDto], description: 'The new companies' })
  async addMany(@Body() createCompanyDtos: CreateCompanyDto[]) {
    // TODO: remove; superceded by insertOrUpdateBulk.
    return { companies: await this.companyService.addMany(createCompanyDtos) };
  }

  @Post('v1/find')
  @ApiOperation({ summary: 'Find companies by metadata.' })
  @ApiResponse({ description: 'The matching companies.' })
  @ApiBody({
    type: FindCompanyDto,
    description: 'The fields to look for; companies matching any field will be returned.',
  })
  async find(@Body() findCompanyDto: FindCompanyDto) {
    // TODO: remove; superceded by search.
    return [...(await this.companyService.find(findCompanyDto))];
  }
}
