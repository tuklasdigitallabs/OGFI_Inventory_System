import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

export class PurchaseOrderLineDto {
  @IsOptional()
  @IsUUID()
  supplierItemId?: string;

  @IsUUID()
  itemId!: string;

  @Type(() => Number)
  @Min(0.000001)
  qty!: number;

  @IsUUID()
  uomId!: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  costOverrideReason?: string;
}

export class CreatePurchaseOrderDto {
  @IsUUID()
  supplierId!: string;

  @IsUUID()
  locationId!: string;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lines!: PurchaseOrderLineDto[];
}

export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lines?: PurchaseOrderLineDto[];
}

export class ApprovePurchaseOrderDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class RejectPurchaseOrderDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ClosePurchaseOrderBalanceDto {
  @IsString()
  remarks!: string;
}

export class ReceivingLineDto {
  @IsUUID()
  itemId!: string;

  @Type(() => Number)
  @Min(0)
  acceptedQty!: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  rejectedQty?: number;

  @Type(() => Number)
  @Min(0)
  unitCost!: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateReceivingDto {
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @IsUUID()
  supplierId!: string;

  @IsUUID()
  locationId!: string;

  @IsDateString()
  businessDate!: string;

  @IsString()
  @IsNotEmpty()
  drReference!: string;

  @IsString()
  @IsNotEmpty()
  invoiceReference!: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceivingLineDto)
  lines!: ReceivingLineDto[];
}
