import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SalesService } from './sales.service';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('batches')
  createBatch(@Body() body: unknown) {
    return this.salesService.action('batches.create', body);
  }

  @Get('batches/:id')
  getBatch(@Param('id') id: string) {
    return this.salesService.list('batches.detail', { id });
  }
}
