import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { BranchOpsModule } from './branch-ops/branch-ops.module';
import { CommonModule } from './common/common.module';
import { CostingModule } from './costing/costing.module';
import { LedgerModule } from './ledger/ledger.module';
import { MasterDataModule } from './master-data/master-data.module';
import { PrismaModule } from './prisma/prisma.module';
import { PurchasingModule } from './purchasing/purchasing.module';
import { LocationAccessGuard } from './rbac/guards/location-access.guard';
import { PermissionsGuard } from './rbac/guards/permissions.guard';
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
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: LocationAccessGuard,
    },
  ],
})
export class AppModule {}
