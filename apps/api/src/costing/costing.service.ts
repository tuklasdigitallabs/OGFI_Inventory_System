import { Injectable } from '@nestjs/common';
import { LedgerEvent, Prisma, TransactionType } from '@prisma/client';

type CostingEvent = Pick<
  LedgerEvent,
  'qtyIn' | 'qtyOut' | 'unitCostAtTime' | 'createdAt' | 'businessDate'
>;

export interface InventoryState {
  qtyOnHand: Prisma.Decimal;
  averageUnitCost: Prisma.Decimal;
  inventoryValue: Prisma.Decimal;
}

const CURRENT_AVERAGE_COST_TRANSACTION_TYPES = new Set<TransactionType>([
  TransactionType.TRANSFER_OUT,
  TransactionType.WASTAGE,
  TransactionType.ISSUE_TO_OPS,
  TransactionType.SALE_CONSUMPTION,
  TransactionType.STOCK_COUNT,
  TransactionType.ADJUSTMENT,
]);

@Injectable()
export class CostingService {
  calculateExtendedCost(quantity: number, unitCost: number) {
    return quantity * unitCost;
  }

  calculateState(events: CostingEvent[]): InventoryState {
    let qtyOnHand = new Prisma.Decimal(0);
    let inventoryValue = new Prisma.Decimal(0);

    for (const event of this.sortEvents(events)) {
      if (event.qtyIn.gt(0)) {
        qtyOnHand = qtyOnHand.add(event.qtyIn);
        inventoryValue = inventoryValue.add(
          event.qtyIn.mul(event.unitCostAtTime),
        );
        continue;
      }

      if (event.qtyOut.gt(0)) {
        qtyOnHand = qtyOnHand.sub(event.qtyOut);
        inventoryValue = inventoryValue.sub(
          event.qtyOut.mul(event.unitCostAtTime),
        );

        if (qtyOnHand.lte(0)) {
          inventoryValue = new Prisma.Decimal(0);
        }
      }
    }

    return {
      qtyOnHand,
      averageUnitCost: qtyOnHand.gt(0)
        ? inventoryValue.div(qtyOnHand)
        : new Prisma.Decimal(0),
      inventoryValue,
    };
  }

  calculateInboundAverage(
    currentState: InventoryState,
    qtyIn: Prisma.Decimal,
    unitCost: Prisma.Decimal,
  ) {
    const nextQty = currentState.qtyOnHand.add(qtyIn);

    if (nextQty.lte(0)) {
      return new Prisma.Decimal(0);
    }

    return currentState.inventoryValue.add(qtyIn.mul(unitCost)).div(nextQty);
  }

  shouldUseCurrentAverageCost(transactionType: TransactionType) {
    return CURRENT_AVERAGE_COST_TRANSACTION_TYPES.has(transactionType);
  }

  private sortEvents<T extends CostingEvent>(events: T[]) {
    return [...events].sort((left, right) => {
      const businessDateDiff =
        left.businessDate.getTime() - right.businessDate.getTime();

      if (businessDateDiff !== 0) {
        return businessDateDiff;
      }

      return left.createdAt.getTime() - right.createdAt.getTime();
    });
  }
}
