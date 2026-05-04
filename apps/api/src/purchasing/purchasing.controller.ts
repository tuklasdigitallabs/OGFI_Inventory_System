import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PurchasingService } from './purchasing.service';

@Controller('purchasing')
export class PurchasingController {
  constructor(private readonly purchasingService: PurchasingService) {}

  @Get('purchase-orders')
  listPurchaseOrders(@Query() query: Record<string, string>) {
    return this.purchasingService.list('purchase-orders', query);
  }

  @Post('purchase-orders')
  createPurchaseOrder(@Body() body: unknown) {
    return this.purchasingService.action('purchase-orders.create', body);
  }

  @Get('purchase-orders/:id')
  getPurchaseOrder(@Param('id') id: string) {
    return this.purchasingService.list('purchase-orders.detail', { id });
  }

  @Post('purchase-orders/:id/submit')
  submitPurchaseOrder(@Param('id') id: string) {
    return this.purchasingService.action('purchase-orders.submit', { id });
  }

  @Post('purchase-orders/:id/approve')
  approvePurchaseOrder(@Param('id') id: string, @Body() body: unknown) {
    return this.purchasingService.action('purchase-orders.approve', { id, body });
  }

  @Post('receivings')
  receiveGoods(@Body() body: unknown) {
    return this.purchasingService.action('receivings.create', body);
  }

  @Get('receivings/:id')
  getReceiving(@Param('id') id: string) {
    return this.purchasingService.list('receivings.detail', { id });
  }
}
