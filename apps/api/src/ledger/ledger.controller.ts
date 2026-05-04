import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { LedgerService } from './ledger.service';

@Controller()
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get('inventory/stock-on-hand')
  stockOnHand(@Query() query: Record<string, string>) {
    return this.ledgerService.list('inventory.stock-on-hand', query);
  }

  @Get('inventory/movements')
  movements(@Query() query: Record<string, string>) {
    return this.ledgerService.list('inventory.movements', query);
  }

  @Post('ledger/events')
  postEvent(@Body() body: unknown) {
    return this.ledgerService.action('ledger.events.post', body);
  }

  @Get('ledger/events/:id')
  getEvent(@Param('id') id: string) {
    return this.ledgerService.list('ledger.events.detail', { id });
  }
}
