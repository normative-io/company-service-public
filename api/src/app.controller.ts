import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  default(): string {
    return 'Company Service';
  }
}
