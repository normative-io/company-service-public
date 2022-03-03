import { Body, Controller, Delete, HttpCode, HttpException, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InsertOrUpdateDto } from './dto/insert-or-update.dto';
import { MarkDeletedDto } from './dto/mark-deleted.dto';
import { SearchDto } from './dto/search.dto';
import { CompanyService } from './company.service';

@ApiTags('company')
@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post('v1/insertOrUpdate')
  @ApiOperation({ summary: 'Add/update metadata of the specified companies.' })
  @ApiResponse({ description: 'The metadata of the new/updated companies.' })
  @ApiBody({ type: [InsertOrUpdateDto], description: 'The new/updated companies.' })
  async insertOrUpdate(@Body() insertOrUpdateDtos: InsertOrUpdateDto[]) {
    // Attempts to insertOrUpdate every input request.
    // Return an error containing all the error messages if >0 of the requests failed.
    const results = [];
    const errors: string[] = [];
    const promises = await Promise.allSettled(insertOrUpdateDtos.map((dto) => this.companyService.insertOrUpdate(dto)));
    for (const [i, promise] of promises.entries()) {
      if (promise.status == 'fulfilled') {
        const [company, message] = promise.value;
        results.push({ company, message });
      } else {
        errors.push(`Error in request ${JSON.stringify(insertOrUpdateDtos[i])}: ${promise.reason}`);
      }
    }
    if (errors.length > 0) {
      throw new HttpException(
        `${errors.length} requests failed: ${errors.join('\n')}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return results;
  }

  @Delete('v1/markDeleted')
  @ApiOperation({ summary: 'Mark a company as deleted. Deleted companies do not show up in searches' })
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
    const [companies, message] = await this.companyService.search(searchDto);
    return { companies, message };
  }
}
