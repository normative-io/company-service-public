import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { COMPANY_SERVICE, ICompanyService } from './company-service.interface';
import { CreateCompanyDto } from './dto/create-company.dto';
import { FindCompanyDto } from './dto/find-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('company')
@Controller('company')
export class CompanyController {
  constructor(
    @Inject(COMPANY_SERVICE)
    private readonly companyService: ICompanyService,
  ) {}

  @Get('v1')
  @ApiOperation({ summary: 'Look up metadata for a company.' })
  @ApiResponse({ description: 'The metadata of the matching company.' })
  v1() {
    return { description: 'example-company' };
  }

  @Get('v1/companies')
  @ApiOperation({ summary: 'List all companies.' })
  @ApiResponse({ description: 'All the available companies.' })
  async companies() {
    return { companies: await this.companyService.listAll() };
  }

  @Post('v1/add')
  @ApiOperation({ summary: 'Add a company.' })
  @ApiResponse({ description: 'The new company, including any initialised fields.' })
  @ApiBody({ type: CreateCompanyDto, description: 'The new company' })
  async add(@Body() createCompanyDto: CreateCompanyDto) {
    return { company: await this.companyService.add(createCompanyDto) };
  }

  @Post('v1/addMany')
  @ApiOperation({ summary: 'Add many companies.' })
  @ApiResponse({ description: 'The new companies, including any initialised fields.' })
  @ApiBody({ type: [CreateCompanyDto], description: 'The new companies' })
  async addMany(@Body() createCompanyDtos: CreateCompanyDto[]) {
    return { companies: await this.companyService.addMany(createCompanyDtos) };
  }

  @Get('v1/:id')
  @ApiOperation({ summary: 'Retrieve a company given its id.' })
  @ApiResponse({ description: 'The matching company.' })
  async getById(@Param('id') id: string) {
    return { company: await this.companyService.getById(id) };
  }

  @Delete('v1/delete/:id')
  @ApiOperation({ summary: 'Delete a company given its id.' })
  @ApiResponse({ description: 'The number of remaining companies.' })
  async delete(@Param('id') id: string) {
    return { nr_companies: await this.companyService.delete(id) };
  }

  @Patch('v1/update/:id')
  @ApiOperation({ summary: 'Update a company.' })
  @ApiResponse({ description: 'The updated company.' })
  @ApiBody({ type: UpdateCompanyDto, description: 'The fields to update. Absent fields will be ignored.' })
  async update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto) {
    return { company: await this.companyService.update(id, updateCompanyDto) };
  }

  @Post('v1/find')
  @ApiOperation({ summary: 'Find companies by metadata.' })
  @ApiResponse({ description: 'The matching companies.' })
  @ApiBody({
    type: FindCompanyDto,
    description: 'The fields to look for; companies matching any field will be returned.',
  })
  async find(@Body() findCompanyDto: FindCompanyDto) {
    return [...(await this.companyService.find(findCompanyDto))];
  }
}
