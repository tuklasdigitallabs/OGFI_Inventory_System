import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { ItemType, LocationType, ReasonCodeType } from "@prisma/client";

export class CreateCategoryDto {
  @IsString()
  name!: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateUomDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;
}

export class UpdateUomDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateUomConversionDto {
  @IsUUID()
  fromUomId!: string;

  @IsUUID()
  toUomId!: string;

  @Type(() => Number)
  @Min(0.000001)
  factor!: number;
}

export class UpdateUomConversionDto {
  @IsOptional()
  @IsUUID()
  fromUomId?: string;

  @IsOptional()
  @IsUUID()
  toUomId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0.000001)
  factor?: number;
}

export class CreateLocationDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsEnum(LocationType)
  type!: LocationType;
}

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateSupplierDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateReasonCodeDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsEnum(ReasonCodeType)
  type!: ReasonCodeType;
}

export class UpdateReasonCodeDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(ReasonCodeType)
  type?: ReasonCodeType;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateItemDto {
  @IsString()
  sku!: string;

  @IsString()
  name!: string;

  @IsEnum(ItemType)
  itemType!: ItemType;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsUUID()
  baseUomId!: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsBoolean()
  looseCountEnabled?: boolean;

  @IsOptional()
  @IsUUID()
  looseWholeUomId?: string;

  @IsOptional()
  @IsUUID()
  looseRemainderUomId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0.000001)
  looseWholeUnitQty?: number;
}

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(ItemType)
  itemType?: ItemType;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsUUID()
  baseUomId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  lowStockThreshold?: number | null;

  @IsOptional()
  @IsBoolean()
  looseCountEnabled?: boolean;

  @IsOptional()
  @IsUUID()
  looseWholeUomId?: string | null;

  @IsOptional()
  @IsUUID()
  looseRemainderUomId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @Min(0.000001)
  looseWholeUnitQty?: number | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class RecipeLineDto {
  @IsUUID()
  ingredientId!: string;

  @Type(() => Number)
  @Min(0.000001)
  qty!: number;

  @IsUUID()
  uomId!: string;
}

export class CreateRecipeDto {
  @IsUUID()
  outputItemId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;

  @Type(() => Number)
  @Min(0.000001)
  servingQty!: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0.01)
  @Max(999.99)
  yieldPercent?: number;

  @IsOptional()
  @IsString()
  yieldOverrideReason?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  wastageFactor?: number;

  @IsOptional()
  @IsString()
  wastageOverrideReason?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeLineDto)
  lines!: RecipeLineDto[];
}

export class UpdateRecipeDto {
  @IsOptional()
  @IsUUID()
  outputItemId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0.000001)
  servingQty?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0.01)
  @Max(999.99)
  yieldPercent?: number;

  @IsOptional()
  @IsString()
  yieldOverrideReason?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  wastageFactor?: number;

  @IsOptional()
  @IsString()
  wastageOverrideReason?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeLineDto)
  lines?: RecipeLineDto[];
}

export class CreateRecipeYieldObservationDto {
  @Type(() => Number)
  @Min(0.000001)
  expectedOutputQty!: number;

  @Type(() => Number)
  @Min(0.000001)
  actualOutputQty!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
