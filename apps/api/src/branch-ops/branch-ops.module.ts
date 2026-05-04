import { Module } from '@nestjs/common';
import { BranchOpsController } from './branch-ops.controller';
import { BranchOpsService } from './branch-ops.service';

@Module({
  controllers: [BranchOpsController],
  providers: [BranchOpsService],
})
export class BranchOpsModule {}
