import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export const REPORT_KEYS = [
  "stock-on-hand",
  "stock-valuation",
  "movements",
  "wastage-summary",
  "transfer-variance",
  "low-stock",
] as const;

export type ReportKey = (typeof REPORT_KEYS)[number];

export class RunReportDto {
  @IsIn(REPORT_KEYS)
  reportKey!: ReportKey;

  @IsIn(["CSV"])
  format!: "CSV";

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  itemType?: string;
}
