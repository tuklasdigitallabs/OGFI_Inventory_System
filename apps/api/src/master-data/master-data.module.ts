import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CostingModule } from "../costing/costing.module";
import { MasterDataController } from "./master-data.controller";
import { MasterDataImportService } from "./master-data-import.service";
import { MasterDataService } from "./master-data.service";

@Module({
  imports: [AuditModule, CostingModule],
  controllers: [MasterDataController],
  providers: [MasterDataImportService, MasterDataService],
})
export class MasterDataModule {}
