import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { LocationAccess } from '../rbac/decorators/location-access.decorator';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { PurchasingService } from './purchasing.service';

@Controller('purchasing')
export class PurchasingController {
  constructor(private readonly purchasingService: PurchasingService) {}

  @Get('purchase-orders')
  @Permissions('purchasing.purchase-orders:read')
  @LocationAccess({ source: 'query', key: 'locationId' })
  listPurchaseOrders(@Query() query: Record<string, string>) {
    return this.purchasingService.list('purchase-orders', query);
  }

  @Post('purchase-orders')
  @Permissions('purchasing.purchase-orders:create')
  @LocationAccess({ source: 'body', key: 'locationId' })
  createPurchaseOrder(@Body() body: unknown) {
    return this.purchasingService.action('purchase-orders.create', body);
  }

  @Get('purchase-orders/:id')
  @Permissions('purchasing.purchase-orders:read')
  getPurchaseOrder(@Param('id') id: string) {
    return this.purchasingService.list('purchase-orders.detail', { id });
  }

  @Post('purchase-orders/:id/submit')
  @Permissions('purchasing.purchase-orders:create')
  submitPurchaseOrder(@Param('id') id: string) {
    return this.purchasingService.action('purchase-orders.submit', { id });
  }

  @Post('purchase-orders/:id/approve')
  @Permissions('purchasing.purchase-orders:approve')
  approvePurchaseOrder(@Param('id') id: string, @Body() body: unknown) {
    return this.purchasingService.action('purchase-orders.approve', { id, body });
  }

  @Post('receivings')
  @Permissions('purchasing.receivings:create')
  @LocationAccess({ source: 'body', key: 'locationId' })
  receiveGoods(@Body() body: unknown) {
    return this.purchasingService.action('receivings.create', body);
  }

  @Get('receivings/:id')
  @Permissions('purchasing.receivings:create')
  getReceiving(@Param('id') id: string) {
    return this.purchasingService.list('receivings.detail', { id });
  }
}
