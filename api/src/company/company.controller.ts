import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('company')
@Controller('company')
export class CompanyController {
  @Get('v1')
  @ApiOperation({ summary: 'Look up metadata for a company.' })
  @ApiResponse({ description: 'The metadata of the matching company.' })
  v1() {
    return { description: 'example-company' };
  }
}
