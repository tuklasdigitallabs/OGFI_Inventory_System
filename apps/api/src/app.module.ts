import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BranchOpsModule } from './branch-ops/branch-ops.module';
import { CommonModule } from './common/common.module';
import { CostingModule } from './costing/costing.module';
import { LedgerModule } from './ledger/ledger.module';
import { MasterDataModule } from './master-data/master-data.module';
import { PrismaModule } from './prisma/prisma.module';
import { PurchasingModule } from './purchasing/purchasing.module';
import { RbacModule } from './rbac/rbac.module';
import { ReportsModule } from './reports/reports.module';
import { SalesModule } from './sales/sales.module';
import { SyncModule } from './sync/sync.module';
import { TransfersModule } from './transfers/transfers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    PrismaModule,
    AuthModule,
    RbacModule,
    AdminModule,
    MasterDataModule,
    LedgerModule,
    CostingModule,
    PurchasingModule,
    TransfersModule,
    BranchOpsModule,
    SalesModule,
    ReportsModule,
    SyncModule,
    AuditModule,
  ],
})
export class AppModule {}
