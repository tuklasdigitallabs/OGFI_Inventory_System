import { Type } from "class-transformer";
import {
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class CreateAdjustmentRequestDto {
  @IsUUID()
  locationId!: string;

  @IsUUID()
  itemId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  qtyIn?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  qtyOut?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  unitCostAtTime!: number;

  @IsDateString()
  businessDate!: string;

  @IsUUID()
  reasonCodeId!: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RejectAdjustmentRequestDto {
  @IsString()
  reason!: string;
}
