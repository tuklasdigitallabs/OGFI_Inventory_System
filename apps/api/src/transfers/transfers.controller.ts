import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { LocationAccess } from '../rbac/decorators/location-access.decorator';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { TransfersService } from './transfers.service';

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  @Permissions('transfers:read')
  listTransfers(@Query() query: Record<string, string>) {
    return this.transfersService.list('list', query);
  }

  @Post()
  @Permissions('transfers:create')
  @LocationAccess({ source: 'body', key: 'sourceLocationId' }, { source: 'body', key: 'targetLocationId' })
  createTransfer(@Body() body: unknown) {
    return this.transfersService.action('create', body);
  }

  @Get(':id')
  @Permissions('transfers:read')
  getTransfer(@Param('id') id: string) {
    return this.transfersService.list('detail', { id });
  }

  @Post(':id/approve')
  @Permissions('transfers:approve')
  approveTransfer(@Param('id') id: string, @Body() body: unknown) {
    return this.transfersService.action('approve', { id, body });
  }

  @Post(':id/dispatch')
  @Permissions('transfers:dispatch')
  dispatchTransfer(@Param('id') id: string, @Body() body: unknown) {
    return this.transfersService.action('dispatch', { id, body });
  }

  @Post(':id/receive')
  @Permissions('transfers:receive')
  receiveTransfer(@Param('id') id: string, @Body() body: unknown) {
    return this.transfersService.action('receive', { id, body });
  }

  @Get(':id/variance')
  @Permissions('transfers:read')
  getVariance(@Param('id') id: string) {
    return this.transfersService.list('variance', { id });
  }
}
