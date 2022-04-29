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
import { Body, Controller, Post, Inject } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LookupRequest, LookupResponse } from '../dto/lookup.dto';
import { ScraperRegistry, SCRAPER_REGISTRY } from './registry.service';

@ApiTags('scraper')
@Controller('scraper')
export class ScraperController {
  constructor(
    @Inject(SCRAPER_REGISTRY)
    private readonly scraperRegistry: ScraperRegistry,
  ) {}

  @Post('lookup')
  @ApiOperation({ summary: 'Request on-demand lookup of a company.' })
  @ApiResponse({ type: LookupResponse })
  @ApiBody({ type: LookupRequest })
  async lookup(@Body() req: LookupRequest): Promise<LookupResponse> {
    return await this.scraperRegistry.lookup(req);
  }
}
