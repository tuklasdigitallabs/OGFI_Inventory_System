import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { LocationAccess } from '../rbac/decorators/location-access.decorator';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { BranchOpsService } from './branch-ops.service';

@Controller('branch')
export class BranchOpsController {
  constructor(private readonly branchOpsService: BranchOpsService) {}

  @Post('wastage')
  @Permissions('branch.wastage:create')
  @LocationAccess({ source: 'body', key: 'locationId' })
  createWastage(@Body() body: unknown) {
    return this.branchOpsService.action('wastage.create', body);
  }

  @Get('wastage')
  @Permissions('branch.wastage:read')
  @LocationAccess({ source: 'query', key: 'locationId' })
  listWastage(@Query() query: Record<string, string>) {
    return this.branchOpsService.list('wastage', query);
  }

  @Post('stock-counts')
  @Permissions('branch.stock-counts:submit')
  @LocationAccess({ source: 'body', key: 'locationId' })
  submitStockCount(@Body() body: unknown) {
    return this.branchOpsService.action('stock-counts.submit', body);
  }

  @Get('stock-counts/:id')
  @Permissions('branch.stock-counts:read')
  getStockCount(@Param('id') id: string) {
    return this.branchOpsService.list('stock-counts.detail', { id });
  }

  @Post('issues')
  @Permissions('branch.issues:create')
  @LocationAccess({ source: 'body', key: 'locationId' })
  createIssueToOps(@Body() body: unknown) {
    return this.branchOpsService.action('issues.create', body);
  }
}
