import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CostingModule } from "../costing/costing.module";
import { MasterDataController } from "./master-data.controller";
import { MasterDataService } from "./master-data.service";

@Module({
  imports: [AuditModule, CostingModule],
  controllers: [MasterDataController],
  providers: [MasterDataService],
})
export class MasterDataModule {}
