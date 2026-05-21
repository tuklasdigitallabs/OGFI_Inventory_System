import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { TransactionType } from "@prisma/client";

export class SyncEventPayloadDto {
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

  @IsOptional()
  @IsUUID()
  reasonCodeId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SubmitSyncEventDto {
  @IsUUID()
  uuid!: string;

  @IsEnum(TransactionType)
  eventType!: TransactionType;

  @ValidateNested()
  @Type(() => SyncEventPayloadDto)
  payload!: SyncEventPayloadDto;
}

export class SubmitSyncBatchDto {
  @IsUUID()
  uuid!: string;

  @IsString()
  deviceId!: string;

  @IsUUID()
  locationId!: string;

  @IsDateString()
  clientCreatedAt!: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitSyncEventDto)
  events!: SubmitSyncEventDto[];
}
