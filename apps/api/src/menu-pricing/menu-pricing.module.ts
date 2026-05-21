import { Module } from "@nestjs/common";
import { CostingModule } from "../costing/costing.module";
import { MenuPricingController } from "./menu-pricing.controller";
import { MenuPricingService } from "./menu-pricing.service";

@Module({
  imports: [CostingModule],
  controllers: [MenuPricingController],
  providers: [MenuPricingService],
})
export class MenuPricingModule {}
