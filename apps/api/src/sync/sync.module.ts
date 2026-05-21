import { Module } from "@nestjs/common";
import { BranchOpsModule } from "../branch-ops/branch-ops.module";
import { LedgerModule } from "../ledger/ledger.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";

@Module({
  imports: [BranchOpsModule, LedgerModule, PrismaModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
