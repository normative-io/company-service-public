import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Company } from './company.model';
import { InMemoryCompanyService } from './inmemory.company.service';

@ApiTags('company')
@Controller('company')
export class CompanyController {

  constructor(private readonly companyService: InMemoryCompanyService) { }

  @Get('v1')
  @ApiOperation({ summary: 'Look up metadata for a company.' })
  @ApiResponse({ description: 'The metadata of the matching company.' })
  v1() {
    return { description: 'example-company' };
  }

  @Get('v1/companies')
  // TODO: Remove this operation once we can connect to a real database or system. 
  // Returning a million companies won't be useful or practical.
  @ApiOperation({ summary: 'List all companies.' })
  @ApiResponse({ description: 'All the available companies.' })
  companies() {
    return { companies: this.companyService.listAll() };
  }

  @Post('v1/add')
  @ApiOperation({ summary: 'Add a company.' })
  @ApiResponse({ description: 'The new company, including any initialised fields.' })
  @ApiBody({ type: Company, description: 'The new company' })
  add(@Body() company: Company) {
    return { company: this.companyService.add(company) };
  }

  @Get('v1/:id')
  @ApiOperation({ summary: 'Retrieve a company given its id.' })
  @ApiResponse({ description: 'The matching company.' })
  getById(@Param('id') id: string) {
    return { company: this.companyService.getById(id) };
  }

  @Delete('v1/delete/:id')
  @ApiOperation({ summary: 'Delete a company given its id.' })
  // TODO: Make this operation return nothing once we can connect to a real database or system. 
  // Calculating the number of remaining companies won't be useful or practical then.
  @ApiResponse({ description: 'The number of remaining companies.' })
  delete(@Param('id') id: string) {
    return { nr_companies: this.companyService.delete(id) };
  }

  @Patch('v1/update/:id')
  @ApiOperation({ summary: 'Update a company.' })
  @ApiResponse({ description: 'The updated company.' })
  @ApiBody({ type: Company, description: 'The fields to update. Absent fields will be ignored.' })
  update(@Param('id') id: string, @Body() company: Company) {
    return { company: this.companyService.update(id, company) };
  }
}
