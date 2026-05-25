import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ItemType, Prisma, ReportFormat, ReportStatus } from "@prisma/client";
import { AuthenticatedUser } from "../auth/types";
import { PrismaService } from "../prisma/prisma.service";
import { REPORT_KEYS, ReportKey, RunReportDto } from "./dto/reports.dto";

type ReportRunResponse = {
  id: string;
  reportKey: string;
  reportName: string;
  status: ReportStatus;
  format: ReportFormat;
  parameters: Prisma.JsonValue;
  outputUrl: string | null;
  outputContent?: string | null;
  error: string | null;
  requestedById: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CsvReport = {
  columns: string[];
  rows: Array<Array<string | number | null | undefined>>;
};

const reportCatalog: Record<
  ReportKey,
  { description: string; label: string; requiresDateRange?: boolean }
> = {
  "stock-on-hand": {
    label: "Stock On Hand",
    description: "Current item/location balances from ledger events.",
  },
  "stock-valuation": {
    label: "Stock Valuation",
    description: "Current quantity and inventory value by item/location.",
  },
  movements: {
    label: "Inventory Movements",
    description: "Ledger movements by date, location, item, and reference.",
    requiresDateRange: true,
  },
  "wastage-summary": {
    label: "Wastage Summary",
    description: "Posted wastage quantities and cost by reason.",
    requiresDateRange: true,
  },
  "transfer-variance": {
    label: "Transfer Variance",
    description:
      "Transfer lines where dispatched and received quantities differ.",
  },
  "low-stock": {
    label: "Low Stock",
    description: "Current balances at or below item low-stock thresholds.",
  },
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  catalog() {
    return {
      resource: "reports.catalog",
      data: REPORT_KEYS.map((key) => ({
        key,
        format: "CSV",
        ...reportCatalog[key],
      })),
    };
  }

  async runReport(dto: RunReportDto, user: AuthenticatedUser) {
    this.assertLocationAccess(dto.locationId, user);

    const parameters = this.toParameters(dto, user);
    const startedAt = new Date();

    const run = await this.prisma.reportRun.create({
      data: {
        reportKey: dto.reportKey,
        status: ReportStatus.PROCESSING,
        format: ReportFormat.CSV,
        parameters: parameters as Prisma.InputJsonValue,
        requestedById: user.id,
        scopeLocationIds: parameters.locationIds,
        startedAt,
      },
    });

    try {
      const report = await this.buildReport(dto.reportKey, parameters);
      const outputContent = toCsv(report);

      const completed = await this.prisma.reportRun.update({
        where: { id: run.id },
        data: {
          status: ReportStatus.COMPLETED,
          completedAt: new Date(),
          outputUrl: `/api/reports/runs/${run.id}/download`,
          outputContent,
        },
      });

      return this.toRunResponse(completed);
    } catch (error) {
      const failed = await this.prisma.reportRun.update({
        where: { id: run.id },
        data: {
          status: ReportStatus.FAILED,
          completedAt: new Date(),
          error:
            error instanceof Error ? error.message : "Unable to build report.",
        },
      });

      return this.toRunResponse(failed);
    }
  }

  async listRuns(query: Record<string, string> = {}, user: AuthenticatedUser) {
    const reportKey = REPORT_KEYS.includes(query.reportKey as ReportKey)
      ? query.reportKey
      : undefined;
    const status = ["QUEUED", "PROCESSING", "COMPLETED", "FAILED"].includes(
      query.status,
    )
      ? (query.status as ReportStatus)
      : undefined;

    const runs = await this.prisma.reportRun.findMany({
      where: {
        reportKey,
        status,
        OR: [
          { scopeLocationIds: { hasSome: user.locationIds } },
          { scopeLocationIds: { isEmpty: true } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: this.parseTake(query.take),
    });

    return {
      resource: "reports.runs",
      data: runs
        .filter((run) => this.canReadRun(run.parameters, user))
        .map((run) => this.toRunResponse(run)),
    };
  }

  async getRun(id: string, user: AuthenticatedUser) {
    const run = await this.findReadableRun(id, user);

    return this.toRunResponse(run);
  }

  async downloadRun(id: string, user: AuthenticatedUser) {
    const run = await this.findReadableRun(id, user);

    if (run.status !== ReportStatus.COMPLETED) {
      throw new BadRequestException("Report is not ready for download.");
    }

    const content =
      run.outputContent ??
      toCsv(
        await this.buildReport(
          run.reportKey as ReportKey,
          run.parameters as ReportParameters,
        ),
      );

    return {
      filename: `${run.reportKey}-${formatDateForFilename(run.createdAt)}.csv`,
      contentType: "text/csv",
      content,
    };
  }

  private async findReadableRun(id: string, user: AuthenticatedUser) {
    const run = await this.prisma.reportRun.findUnique({ where: { id } });

    if (!run || !this.canReadRun(run.parameters, user)) {
      throw new NotFoundException("Report run not found.");
    }

    return run;
  }

  private async buildReport(
    reportKey: ReportKey,
    parameters: ReportParameters,
  ): Promise<CsvReport> {
    if (reportKey === "movements") {
      return this.movementsReport(parameters);
    }

    if (reportKey === "wastage-summary") {
      return this.wastageSummaryReport(parameters);
    }

    if (reportKey === "transfer-variance") {
      return this.transferVarianceReport(parameters);
    }

    const stockRows = await this.stockRows(parameters);

    if (reportKey === "stock-valuation") {
      return {
        columns: [
          "Location",
          "SKU",
          "Item",
          "UOM",
          "Qty On Hand",
          "Inventory Value",
        ],
        rows: stockRows.map((row) => [
          row.locationCode,
          row.sku,
          row.itemName,
          row.uom,
          row.qtyOnHand,
          row.inventoryValue,
        ]),
      };
    }

    if (reportKey === "low-stock") {
      return {
        columns: [
          "Location",
          "SKU",
          "Item",
          "UOM",
          "Qty On Hand",
          "Low Stock Threshold",
          "Status",
        ],
        rows: stockRows
          .filter(
            (row) =>
              row.lowStockThreshold !== null &&
              row.qtyOnHand <= row.lowStockThreshold,
          )
          .map((row) => [
            row.locationCode,
            row.sku,
            row.itemName,
            row.uom,
            row.qtyOnHand,
            row.lowStockThreshold,
            row.qtyOnHand <= 0 ? "OUT_OF_STOCK" : "LOW",
          ]),
      };
    }

    return {
      columns: [
        "Location",
        "SKU",
        "Item",
        "Category",
        "Item Type",
        "UOM",
        "Qty On Hand",
        "Average Unit Cost",
        "Inventory Value",
      ],
      rows: stockRows.map((row) => [
        row.locationCode,
        row.sku,
        row.itemName,
        row.categoryName,
        row.itemType,
        row.uom,
        row.qtyOnHand,
        row.averageUnitCost,
        row.inventoryValue,
      ]),
    };
  }

  private async movementsReport(
    parameters: ReportParameters,
  ): Promise<CsvReport> {
    const events = await this.prisma.ledgerEvent.findMany({
      where: this.ledgerWhere(parameters),
      include: {
        item: true,
        location: true,
      },
      orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
      take: 5000,
    });

    return {
      columns: [
        "Business Date",
        "Location",
        "SKU",
        "Item",
        "Movement",
        "Qty In",
        "Qty Out",
        "Unit Cost",
        "Extended Cost",
        "Reference",
      ],
      rows: events.map((event) => [
        formatDate(event.businessDate),
        event.location.code,
        event.item.sku,
        event.item.name,
        event.transactionType,
        Number(event.qtyIn),
        Number(event.qtyOut),
        Number(event.unitCostAtTime),
        Number(event.extendedCost),
        `${event.referenceType}:${event.referenceId}`,
      ]),
    };
  }

  private async wastageSummaryReport(
    parameters: ReportParameters,
  ): Promise<CsvReport> {
    const wastage = await this.prisma.wastage.findMany({
      where: {
        locationId: { in: parameters.locationIds },
        businessDate: this.dateRange(parameters),
      },
      include: {
        location: true,
        reasonCode: true,
        lines: { include: { item: { include: { baseUom: true } } } },
      },
      orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
      take: 5000,
    });

    return {
      columns: [
        "Business Date",
        "Location",
        "Wastage No",
        "Reason",
        "SKU",
        "Item",
        "Qty",
        "UOM",
        "Unit Cost",
        "Extended Cost",
        "Status",
      ],
      rows: wastage.flatMap((record) =>
        record.lines.map((line) => [
          formatDate(record.businessDate),
          record.location.code,
          record.wastageNumber,
          record.reasonCode.name,
          line.item.sku,
          line.item.name,
          Number(line.qty),
          line.item.baseUom.code,
          line.unitCost === null ? "" : Number(line.unitCost),
          line.unitCost === null
            ? ""
            : Number(line.unitCost) * Number(line.qty),
          record.status,
        ]),
      ),
    };
  }

  private async transferVarianceReport(
    parameters: ReportParameters,
  ): Promise<CsvReport> {
    const transfers = await this.prisma.transfer.findMany({
      where: {
        OR: [
          { sourceLocationId: { in: parameters.locationIds } },
          { targetLocationId: { in: parameters.locationIds } },
        ],
      },
      include: {
        sourceLocation: true,
        targetLocation: true,
        lines: { include: { item: { include: { baseUom: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    return {
      columns: [
        "Transfer",
        "Source",
        "Target",
        "SKU",
        "Item",
        "UOM",
        "Picked Qty",
        "Received Qty",
        "Variance Qty",
        "Status",
      ],
      rows: transfers.flatMap((transfer) =>
        transfer.lines
          .filter((line) => {
            const pickedQty = Number(line.pickedQty ?? line.requestedQty);
            const receivedQty = Number(line.receivedQty ?? 0);

            return (
              transfer.status === "VARIANCE_REVIEW" || pickedQty !== receivedQty
            );
          })
          .map((line) => {
            const pickedQty = Number(line.pickedQty ?? line.requestedQty);
            const receivedQty = Number(line.receivedQty ?? 0);

            return [
              transfer.transferNumber,
              transfer.sourceLocation.code,
              transfer.targetLocation.code,
              line.item.sku,
              line.item.name,
              line.item.baseUom.code,
              pickedQty,
              receivedQty,
              pickedQty - receivedQty,
              transfer.status,
            ];
          }),
      ),
    };
  }

  private async stockRows(parameters: ReportParameters) {
    const events = await this.prisma.ledgerEvent.findMany({
      where: this.ledgerWhere(parameters),
      include: {
        item: { include: { baseUom: true, category: true } },
        location: true,
      },
      orderBy: [{ businessDate: "asc" }, { createdAt: "asc" }],
    });

    const rows = new Map<
      string,
      {
        averageUnitCost: number;
        categoryName: string;
        inventoryValue: number;
        itemName: string;
        itemType: string;
        locationCode: string;
        lowStockThreshold: number | null;
        qtyOnHand: number;
        sku: string;
        uom: string;
      }
    >();

    for (const event of events) {
      const key = `${event.locationId}:${event.itemId}`;
      const current = rows.get(key) ?? {
        averageUnitCost: 0,
        categoryName: event.item.category?.name ?? "",
        inventoryValue: 0,
        itemName: event.item.name,
        itemType: event.item.itemType,
        locationCode: event.location.code,
        lowStockThreshold:
          event.item.lowStockThreshold === null
            ? null
            : Number(event.item.lowStockThreshold),
        qtyOnHand: 0,
        sku: event.item.sku,
        uom: event.item.baseUom.code,
      };

      current.qtyOnHand += Number(event.qtyIn) - Number(event.qtyOut);
      current.inventoryValue +=
        Number(event.qtyIn) > 0
          ? Number(event.extendedCost)
          : -Number(event.extendedCost);
      current.averageUnitCost =
        current.qtyOnHand > 0 ? current.inventoryValue / current.qtyOnHand : 0;
      rows.set(key, current);
    }

    return [...rows.values()].filter((row) => row.qtyOnHand !== 0);
  }

  private ledgerWhere(
    parameters: ReportParameters,
  ): Prisma.LedgerEventWhereInput {
    return {
      locationId: { in: parameters.locationIds },
      businessDate: this.dateRange(parameters),
      item: parameters.itemType
        ? { itemType: parameters.itemType as ItemType }
        : undefined,
    };
  }

  private dateRange(parameters: ReportParameters) {
    return {
      gte: parameters.dateFrom ? new Date(parameters.dateFrom) : undefined,
      lte: parameters.dateTo ? endOfDay(parameters.dateTo) : undefined,
    };
  }

  private toParameters(dto: RunReportDto, user: AuthenticatedUser) {
    return {
      dateFrom: dto.dateFrom ?? null,
      dateTo: dto.dateTo ?? null,
      itemType: dto.itemType ?? null,
      locationId: dto.locationId ?? null,
      locationIds: dto.locationId ? [dto.locationId] : user.locationIds,
    };
  }

  private canReadRun(parameters: Prisma.JsonValue, user: AuthenticatedUser) {
    const reportParameters = parameters as ReportParameters;

    return reportParameters.locationIds.every((locationId) =>
      user.locationIds.includes(locationId),
    );
  }

  private assertLocationAccess(
    locationId: string | undefined,
    user: AuthenticatedUser,
  ) {
    if (locationId && !user.locationIds.includes(locationId)) {
      throw new BadRequestException("Selected location is not allowed.");
    }

    if (!locationId && user.locationIds.length === 0) {
      throw new BadRequestException("User has no reportable locations.");
    }
  }

  private parseTake(value?: string) {
    const take = Number(value);

    if (!Number.isFinite(take)) {
      return 50;
    }

    return Math.max(1, Math.min(200, Math.trunc(take)));
  }

  private toRunResponse(run: {
    id: string;
    reportKey: string;
    status: ReportStatus;
    format: ReportFormat;
    parameters: Prisma.JsonValue;
    outputUrl: string | null;
    error: string | null;
    requestedById: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): ReportRunResponse {
    return {
      id: run.id,
      reportKey: run.reportKey,
      reportName:
        reportCatalog[run.reportKey as ReportKey]?.label ?? run.reportKey,
      status: run.status,
      format: run.format,
      parameters: run.parameters,
      outputUrl: run.outputUrl,
      error: run.error,
      requestedById: run.requestedById,
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    };
  }
}

type ReportParameters = {
  dateFrom: string | null;
  dateTo: string | null;
  itemType: string | null;
  locationId: string | null;
  locationIds: string[];
};

function endOfDay(value: string) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function escapeCsv(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);

  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDateForFilename(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function toCsv(report: CsvReport) {
  return [report.columns, ...report.rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");
}
