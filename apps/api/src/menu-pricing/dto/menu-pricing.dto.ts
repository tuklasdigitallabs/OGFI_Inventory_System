import { Type } from "class-transformer";
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class CreateMenuPriceDto {
  @IsUUID()
  recipeId!: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @Type(() => Number)
  @Min(0.01)
  sellingPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0.01)
  @Max(100)
  targetFoodCostPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0.01)
  @Max(100)
  targetGrossMarginPercent?: number;

  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @IsDateString()
  effectiveEndDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateMenuPriceDto {
  @IsOptional()
  @IsUUID()
  locationId?: string | null;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0.01)
  sellingPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0.01)
  @Max(100)
  targetFoodCostPercent?: number | null;

  @IsOptional()
  @Type(() => Number)
  @Min(0.01)
  @Max(100)
  targetGrossMarginPercent?: number | null;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsDateString()
  effectiveEndDate?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
