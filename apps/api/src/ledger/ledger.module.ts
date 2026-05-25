import { Module } from '@nestjs/common';
import { CostingModule } from '../costing/costing.module';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';
import { OpeningInventoryImportService } from './opening-inventory-import.service';

@Module({
  imports: [CostingModule],
  controllers: [LedgerController],
  providers: [LedgerService, OpeningInventoryImportService],
  exports: [LedgerService],
})
export class LedgerModule {}
