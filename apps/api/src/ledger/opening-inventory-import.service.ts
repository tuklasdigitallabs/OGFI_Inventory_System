import { BadRequestException, Injectable } from "@nestjs/common";
import {
  CountStatus,
  Prisma,
  ReferenceType,
  StockCountType,
  TransactionType,
} from "@prisma/client";
import * as ExcelJS from "exceljs";
import { randomUUID } from "crypto";
import { AuthenticatedUser } from "../auth/types";
import { PrismaService } from "../prisma/prisma.service";

type RequestAuditMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

type OpeningInventoryError = {
  errors: string[];
  row: number;
  sheet: string;
  values: Record<string, string>;
};

type ParsedOpeningRow = {
  category: string;
  count: string;
  itemName: string;
  loose: string;
  purchaseUom: string;
  row: number;
  sheet: string;
  unitCost: string;
  uom: string;
};

type ValidOpeningRow = ParsedOpeningRow & {
  baseQty: Prisma.Decimal;
  itemId: string;
  itemSku: string;
  unitCostAtTime: Prisma.Decimal;
};

@Injectable()
export class OpeningInventoryImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importWorkbook(
    buffer: Buffer,
    dto: { businessDate: string; locationId: string },
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata,
  ) {
    if (!dto.locationId || !dto.businessDate || Number.isNaN(Date.parse(dto.businessDate))) {
      throw new BadRequestException("Select a location and valid business date.");
    }

    if (!user.locationIds.includes(dto.locationId)) {
      throw new BadRequestException("Location access denied.");
    }

    const workbook = new ExcelJS.Workbook();

    try {
      await workbook.xlsx.load(
        buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
      );
    } catch {
      throw new BadRequestException("Upload a valid .xlsx workbook.");
    }

    const parsedRows = this.readRows(workbook);
    const errors: OpeningInventoryError[] = [];

    const [location, existingLedgerCount] = await Promise.all([
      this.prisma.location.findFirst({
        where: { id: dto.locationId, active: true },
        select: { code: true, id: true, name: true },
      }),
      this.prisma.ledgerEvent.count({ where: { locationId: dto.locationId } }),
    ]);

    if (!location) {
      throw new BadRequestException("Location does not exist or is inactive.");
    }

    if (existingLedgerCount > 0) {
      throw new BadRequestException(
        "Opening inventory can only be uploaded before the selected location has inventory movements.",
      );
    }

    const validRows = await this.validateRows(parsedRows, errors);

    if (validRows.length === 0 || errors.length > 0) {
      const errorReport = errors.length ? await this.errorWorkbook(errors) : null;

      return {
        errorReportBase64: errorReport?.toString("base64") ?? null,
        errorReportFilename: errorReport
          ? `OGFI_Opening_Inventory_Errors_${formatDateForFilename(new Date())}.xlsx`
          : null,
        errors,
        failed: errors.length,
        imported: 0,
        posted: false,
        stockCountNumber: null,
      };
    }

    const stockCount = await this.prisma.$transaction(async (tx) => {
      const created = await tx.stockCount.create({
        data: {
          businessDate: new Date(dto.businessDate),
          countNumber: await this.nextStockCountNumber(tx),
          countType: StockCountType.OPENING,
          locationId: dto.locationId,
          status: CountStatus.POSTED,
          submittedAt: new Date(),
          approvedAt: new Date(),
          lines: {
            create: validRows.map((row) => ({
              countedQty: row.baseQty,
              itemId: row.itemId,
              systemQty: new Prisma.Decimal(0),
              varianceQty: row.baseQty,
            })),
          },
        },
      });

      for (const row of validRows) {
        if (row.baseQty.eq(0)) {
          continue;
        }

        const extendedCost = row.baseQty.mul(row.unitCostAtTime);

        await tx.ledgerEvent.create({
          data: {
            businessDate: new Date(dto.businessDate),
            createdById: user.id,
            extendedCost,
            itemId: row.itemId,
            locationId: dto.locationId,
            metadata: {
              category: row.category,
              count: row.count,
              importSource: "opening-inventory",
              itemName: row.itemName,
              loose: row.loose,
              purchaseUom: row.purchaseUom,
              stockCountNumber: created.countNumber,
              unitCost: row.unitCostAtTime.toString(),
              uom: row.uom,
              workbookRow: row.row,
            },
            qtyIn: row.baseQty,
            qtyOut: new Prisma.Decimal(0),
            referenceId: created.id,
            referenceType: ReferenceType.COUNT,
            transactionType: TransactionType.STOCK_COUNT,
            unitCostAtTime: row.unitCostAtTime,
            uuid: randomUUID(),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "opening-inventory.import",
          after: {
            businessDate: dto.businessDate,
            imported: validRows.length,
            locationCode: location.code,
            stockCountNumber: created.countNumber,
          },
          entityId: created.id,
          entityType: "StockCount",
          ipAddress: metadata.ipAddress,
          locationId: dto.locationId,
          module: "inventory",
          userAgent: metadata.userAgent,
          userId: user.id,
        },
      });

      return created;
    });

    return {
      errorReportBase64: null,
      errorReportFilename: null,
      errors: [],
      failed: 0,
      imported: validRows.length,
      posted: true,
      stockCountNumber: stockCount.countNumber,
    };
  }

  private readRows(workbook: ExcelJS.Workbook) {
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new BadRequestException("Workbook does not contain a worksheet.");
    }

    const flatRows = this.readFlatErrorRows(worksheet);

    if (flatRows.length > 0) {
      return flatRows;
    }

    const rows: ParsedOpeningRow[] = [];
    let category = "";

    worksheet.eachRow((row, rowNumber) => {
      const firstCell = this.cellText(row.getCell(1));
      const itemName = this.cellText(row.getCell(2));

      if (firstCell.toUpperCase().startsWith("ITEM -")) {
        category = firstCell.replace(/^ITEM -\s*/i, "").trim();
        return;
      }

      if (firstCell.toUpperCase() === "OTHER ITEMS") {
        category = "OTHER ITEMS";
        return;
      }

      if (
        firstCell.toUpperCase() === "NO." ||
        itemName.toUpperCase() === "ITEM" ||
        !itemName.trim()
      ) {
        return;
      }

      const count = this.cellText(row.getCell(5));
      const loose = this.cellText(row.getCell(6));

      if (!count && !loose) {
        return;
      }

      rows.push({
        category,
        count,
        itemName,
        loose,
        purchaseUom: this.cellText(row.getCell(3)),
        row: rowNumber,
        sheet: worksheet.name,
        unitCost: this.cellText(row.getCell(7)),
        uom: this.cellText(row.getCell(4)),
      });
    });

    return rows;
  }

  private readFlatErrorRows(worksheet: ExcelJS.Worksheet) {
    const headers: string[] = [];
    worksheet.getRow(1).eachCell((cell) => headers.push(this.cellText(cell)));

    if (!headers.includes("itemName") || !headers.includes("count")) {
      return [];
    }

    const rows: ParsedOpeningRow[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }

      const values = Object.fromEntries(
        headers.map((header, index) => [
          header,
          this.cellText(row.getCell(index + 1)),
        ]),
      );

      if (!values.itemName || (!values.count && !values.loose)) {
        return;
      }

      rows.push({
        category: values.category ?? "",
        count: values.count ?? "",
        itemName: values.itemName ?? "",
        loose: values.loose ?? "",
        purchaseUom: values.purchaseUom ?? "",
        row: Number(values.originalRow || rowNumber),
        sheet: values.originalSheet || worksheet.name,
        unitCost: values.unitCost ?? "",
        uom: values.uom ?? "",
      });
    });

    return rows;
  }

  private async validateRows(
    rows: ParsedOpeningRow[],
    errors: OpeningInventoryError[],
  ) {
    const items = await this.prisma.item.findMany({
      where: { active: true },
      include: {
        baseUom: true,
        category: true,
        supplierItems: { where: { active: true }, orderBy: { createdAt: "asc" } },
      },
    });
    const uoms = await this.prisma.uom.findMany({ where: { active: true } });
    const conversions = await this.prisma.uomConversion.findMany();
    const itemsByKey = new Map(
      items.map((item) => [
        this.itemKey(item.name, item.category?.name ?? ""),
        item,
      ]),
    );
    const itemsByName = new Map(items.map((item) => [normalize(item.name), item]));
    const uomCodes = new Set(uoms.map((uom) => uom.code));
    const uomCodeById = new Map(uoms.map((uom) => [uom.id, uom.code]));
    const conversionsByKey = new Map(
      conversions.map((conversion) => [
        `${uomCodeById.get(conversion.fromUomId)}:${conversion.toUomId}`,
        conversion.factor,
      ]),
    );
    const validRows: ValidOpeningRow[] = [];
    const seenItemIds = new Set<string>();

    for (const row of rows) {
      const rowErrors: string[] = [];
      const item =
        itemsByKey.get(this.itemKey(row.itemName, row.category)) ??
        itemsByName.get(normalize(row.itemName));

      if (!item) {
        rowErrors.push("Item was not found in active Master Data.");
      }

      const count = this.parseQuantity(row.count || "0", "COUNT", rowErrors);
      const loose = this.parseQuantity(row.loose || "0", "LOOSE", rowErrors);
      const unitCost = this.resolveUnitCost(row.unitCost, item);
      const quantityResult =
        item && count !== null && loose !== null
          ? this.resolveBaseQuantity(
              row.purchaseUom,
              row.uom,
              count,
              loose,
              item,
              uomCodes,
              conversionsByKey,
            )
          : null;

      if (quantityResult?.errors.length) {
        rowErrors.push(...quantityResult.errors);
      }

      if (item && seenItemIds.has(item.id)) {
        rowErrors.push("Duplicate item row for this opening inventory upload.");
      }

      if (rowErrors.length > 0 || !item || !quantityResult) {
        errors.push({
          errors: rowErrors,
          row: row.row,
          sheet: row.sheet,
          values: this.rowValues(row),
        });
        continue;
      }

      seenItemIds.add(item.id);
      validRows.push({
        ...row,
        baseQty: quantityResult.baseQty,
        itemId: item.id,
        itemSku: item.sku,
        unitCostAtTime: unitCost,
      });
    }

    return validRows;
  }

  private resolveBaseQuantity(
    purchaseUom: string,
    uomCode: string,
    count: Prisma.Decimal,
    loose: Prisma.Decimal,
    item: {
      baseUomId: string;
      baseUom: { code: string; id: string };
      sku: string;
    },
    uomCodes: Set<string>,
    conversionsByKey: Map<string, Prisma.Decimal>,
  ) {
    const errors: string[] = [];
    const parsedPack = this.parsePackSize(purchaseUom);
    const countUomCode = normalizeUomCode(uomCode);

    if (!countUomCode) {
      errors.push("UOM is required.");
      return { baseQty: new Prisma.Decimal(0), errors };
    }

    if (!uomCodes.has(countUomCode)) {
      errors.push(`UOM ${countUomCode} does not exist in active Master Data.`);
      return { baseQty: new Prisma.Decimal(0), errors };
    }

    if (parsedPack && !uomCodes.has(parsedPack.measureUomCode)) {
      errors.push(
        `Purchase UOM measure ${parsedPack.measureUomCode} does not exist in active Master Data.`,
      );
      return { baseQty: new Prisma.Decimal(0), errors };
    }

    const fullUnitQty = parsedPack
      ? count.mul(parsedPack.measureQty)
      : count;
    const fullUnitUomCode = parsedPack
      ? parsedPack.measureUomCode
      : countUomCode;
    const fullUnitBaseQty = this.convertByCodes(
      fullUnitQty,
      fullUnitUomCode,
      item,
      conversionsByKey,
      errors,
    );
    const looseBaseQty = this.convertByCodes(
      loose,
      countUomCode,
      item,
      conversionsByKey,
      errors,
    );

    return {
      baseQty: fullUnitBaseQty.add(looseBaseQty),
      errors,
    };
  }

  private convertByCodes(
    qty: Prisma.Decimal,
    fromCode: string,
    item: {
      baseUomId: string;
      baseUom: { code: string; id: string };
      sku: string;
    },
    conversionsByKey: Map<string, Prisma.Decimal>,
    errors: string[],
  ) {
    if (qty.eq(0)) {
      return new Prisma.Decimal(0);
    }

    const factor = conversionsByKey.get(`${fromCode}:${item.baseUomId}`);

    if (fromCode === item.baseUom.code) {
      return qty;
    }

    if (!factor) {
      errors.push(
        `No UOM conversion exists from ${fromCode} to base UOM ${item.baseUom.code} for ${item.sku}.`,
      );
      return new Prisma.Decimal(0);
    }

    return qty.mul(factor);
  }

  private parsePackSize(value: string) {
    const normalized = value.toUpperCase().replace(/\s+/g, "");
    const match = normalized.match(/^(\d+(?:\.\d+)?)([A-Z]+)\/([A-Z]+)$/);

    if (!match) {
      return null;
    }

    return {
      measureQty: new Prisma.Decimal(match[1]),
      measureUomCode: normalizeUomCode(match[2]),
      packageUomCode: normalizeUomCode(match[3]),
    };
  }

  private parseQuantity(
    rawValue: string,
    label: string,
    errors: string[],
  ): Prisma.Decimal | null {
    const value = rawValue.replace(/,/g, "").trim();

    if (!value) {
      return new Prisma.Decimal(0);
    }

    const numeric = Number(value);

    if (!Number.isFinite(numeric) || numeric < 0) {
      errors.push(`${label} must be a valid non-negative number.`);
      return null;
    }

    return new Prisma.Decimal(value);
  }

  private resolveUnitCost(
    rawValue: string,
    item:
      | {
          supplierItems: Array<{ unitCost: Prisma.Decimal | null }>;
        }
      | undefined,
  ) {
    const value = rawValue.replace(/,/g, "").trim();

    if (value) {
      const numeric = Number(value);
      return Number.isFinite(numeric) && numeric >= 0
        ? new Prisma.Decimal(value)
        : new Prisma.Decimal(0);
    }

    const supplierCost = item?.supplierItems.find((supplierItem) =>
      Boolean(supplierItem.unitCost),
    )?.unitCost;

    return supplierCost ?? new Prisma.Decimal(0);
  }

  private itemKey(name: string, category: string) {
    return `${normalize(category)}:${normalize(name)}`;
  }

  private rowValues(row: ParsedOpeningRow) {
    return {
      category: row.category,
      count: row.count,
      itemName: row.itemName,
      loose: row.loose,
      originalRow: String(row.row),
      originalSheet: row.sheet,
      purchaseUom: row.purchaseUom,
      unitCost: row.unitCost,
      uom: row.uom,
    };
  }

  private async errorWorkbook(errors: OpeningInventoryError[]) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Opening Inventory Errors");
    const headers = [
      "originalSheet",
      "originalRow",
      "category",
      "itemName",
      "purchaseUom",
      "uom",
      "count",
      "loose",
      "unitCost",
      "errors",
    ];

    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.max(18, header.length + 4),
    }));

    for (const error of errors) {
      worksheet.addRow({
        ...error.values,
        errors: error.errors.join("; "),
      });
    }

    this.styleHeader(worksheet.getRow(1));
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private styleHeader(row: ExcelJS.Row) {
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = {
      fgColor: { argb: "FF0B5D1E" },
      pattern: "solid",
      type: "pattern",
    };
  }

  private async nextStockCountNumber(tx: Prisma.TransactionClient) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const count = await tx.stockCount.count({
      where: { createdAt: { gte: start, lt: end } },
    });
    const datePart = start.toISOString().slice(0, 10).replace(/-/g, "");

    return `OPN-${datePart}-${String(count + 1).padStart(4, "0")}`;
  }

  private cellText(cell: ExcelJS.Cell) {
    const value = cell.value;

    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "object" && "result" in value) {
      return String(value.result ?? "").trim();
    }

    if (typeof value === "object" && "text" in value) {
      return String(value.text ?? "").trim();
    }

    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    return String(value).trim();
  }
}

function normalize(value: string) {
  return value
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeUomCode(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]+/g, "");
  const aliases: Record<string, string> = {
    BOTTLE: "BTL",
    BOT: "BTL",
    BTL: "BTL",
    G: "G",
    GM: "G",
    GRAM: "G",
    GRAMS: "G",
    KG: "KG",
    KGS: "KG",
    KILO: "KG",
    KILOS: "KG",
    L: "L",
    LITER: "L",
    LITERS: "L",
    ML: "ML",
    PACKS: "PACK",
    PC: "PC",
    PCS: "PC",
    PIECE: "PC",
    PIECES: "PC",
  };

  return aliases[normalized] ?? normalized;
}

function formatDateForFilename(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}
