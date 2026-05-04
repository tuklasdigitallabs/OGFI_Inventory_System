import { Injectable } from '@nestjs/common';

@Injectable()
export class CostingService {
  calculateExtendedCost(quantity: number, unitCost: number) {
    return quantity * unitCost;
  }
}
