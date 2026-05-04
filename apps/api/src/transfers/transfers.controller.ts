import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { TransfersService } from './transfers.service';

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  listTransfers(@Query() query: Record<string, string>) {
    return this.transfersService.list('list', query);
  }

  @Post()
  createTransfer(@Body() body: unknown) {
    return this.transfersService.action('create', body);
  }

  @Get(':id')
  getTransfer(@Param('id') id: string) {
    return this.transfersService.list('detail', { id });
  }

  @Post(':id/approve')
  approveTransfer(@Param('id') id: string, @Body() body: unknown) {
    return this.transfersService.action('approve', { id, body });
  }

  @Post(':id/dispatch')
  dispatchTransfer(@Param('id') id: string, @Body() body: unknown) {
    return this.transfersService.action('dispatch', { id, body });
  }

  @Post(':id/receive')
  receiveTransfer(@Param('id') id: string, @Body() body: unknown) {
    return this.transfersService.action('receive', { id, body });
  }

  @Get(':id/variance')
  getVariance(@Param('id') id: string) {
    return this.transfersService.list('variance', { id });
  }
}
