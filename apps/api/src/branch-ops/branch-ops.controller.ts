import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { BranchOpsService } from './branch-ops.service';

@Controller('branch')
export class BranchOpsController {
  constructor(private readonly branchOpsService: BranchOpsService) {}

  @Post('wastage')
  createWastage(@Body() body: unknown) {
    return this.branchOpsService.action('wastage.create', body);
  }

  @Get('wastage')
  listWastage(@Query() query: Record<string, string>) {
    return this.branchOpsService.list('wastage', query);
  }

  @Post('stock-counts')
  submitStockCount(@Body() body: unknown) {
    return this.branchOpsService.action('stock-counts.submit', body);
  }

  @Get('stock-counts/:id')
  getStockCount(@Param('id') id: string) {
    return this.branchOpsService.list('stock-counts.detail', { id });
  }

  @Post('issues')
  createIssueToOps(@Body() body: unknown) {
    return this.branchOpsService.action('issues.create', body);
  }
}
