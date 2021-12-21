import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Return a simple string for health checking.' })
  @ApiResponse({ description: 'A simple string message' })
  default() {
    return 'Scraper Service';
  }
}
