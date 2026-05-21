import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

export class TransferLineDto {
  @IsUUID()
  itemId!: string;

  @Type(() => Number)
  @Min(0.000001)
  qty!: number;
}

export class CreateTransferDto {
  @IsUUID()
  sourceLocationId!: string;

  @IsUUID()
  targetLocationId!: string;

  @IsOptional()
  @IsDateString()
  neededDate?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransferLineDto)
  lines!: TransferLineDto[];
}

export class ApproveTransferDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class DispatchTransferLineDto {
  @IsUUID()
  lineId!: string;

  @Type(() => Number)
  @Min(0)
  pickedQty!: number;
}

export class DispatchTransferDto {
  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DispatchTransferLineDto)
  lines!: DispatchTransferLineDto[];
}

export class ReceiveTransferLineDto {
  @IsUUID()
  lineId!: string;

  @Type(() => Number)
  @Min(0)
  receivedQty!: number;
}

export class ReceiveTransferDto {
  @IsOptional()
  @IsString()
  varianceNotes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveTransferLineDto)
  lines!: ReceiveTransferLineDto[];
}

export class ResolveTransferVarianceDto {
  @IsIn(["SOURCE_RETAINED", "LOSS_AT_SOURCE", "RECEIVE_BALANCE"])
  resolution!: "SOURCE_RETAINED" | "LOSS_AT_SOURCE" | "RECEIVE_BALANCE";

  @IsOptional()
  @IsString()
  notes?: string;
}
