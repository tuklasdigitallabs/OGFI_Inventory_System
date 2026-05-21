import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { StockCountType } from "@prisma/client";

export class BranchQtyLineDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  uomId!: string;

  @Type(() => Number)
  @Min(0.000001)
  qty!: number;
}

export class CreateWastageDto {
  @IsUUID()
  locationId!: string;

  @IsUUID()
  reasonCodeId!: string;

  @IsDateString()
  businessDate!: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BranchQtyLineDto)
  lines!: BranchQtyLineDto[];
}

export class CreateIssueToOpsDto {
  @IsUUID()
  locationId!: string;

  @IsDateString()
  businessDate!: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BranchQtyLineDto)
  lines!: BranchQtyLineDto[];
}

export class StockCountLineDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  uomId!: string;

  @Type(() => Number)
  @Min(0)
  countedQty!: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  looseWholeUnits?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  looseRemainderQty?: number;
}

export class SubmitStockCountDto {
  @IsUUID()
  locationId!: string;

  @IsEnum(StockCountType)
  countType!: StockCountType;

  @IsDateString()
  businessDate!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockCountLineDto)
  lines!: StockCountLineDto[];
}

export class SalesBatchLineDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  uomId!: string;

  @Type(() => Number)
  @Min(0.000001)
  qtySold!: number;
}

export class CreateSalesBatchDto {
  @IsUUID()
  locationId!: string;

  @IsDateString()
  businessDate!: string;

  @IsOptional()
  @IsString()
  sourceFileUrl?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesBatchLineDto)
  lines!: SalesBatchLineDto[];
}
