import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsUUID,
  Min,
  IsNumber,
} from 'class-validator';
import { ReferenceType, TransactionType } from '@prisma/client';

export class PostLedgerEventDto {
  @IsUUID()
  uuid!: string;

  @IsUUID()
  locationId!: string;

  @IsUUID()
  itemId!: string;

  @IsEnum(TransactionType)
  transactionType!: TransactionType;

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

  @IsEnum(ReferenceType)
  referenceType!: ReferenceType;

  @IsUUID()
  referenceId!: string;

  @IsDateString()
  businessDate!: string;

  @IsOptional()
  @IsUUID()
  approvedById?: string;

  @IsOptional()
  @IsUUID()
  reasonCodeId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
