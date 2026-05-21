import { Module } from '@nestjs/common';
import { CostingModule } from '../costing/costing.module';
import { LedgerModule } from '../ledger/ledger.module';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';

@Module({
  imports: [CostingModule, LedgerModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
