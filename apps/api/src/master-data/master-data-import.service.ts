import { BadRequestException, Injectable } from "@nestjs/common";
import { ItemType, LocationType, Prisma, ReasonCodeType } from "@prisma/client";
import * as ExcelJS from "exceljs";
import { AuthenticatedUser } from "../auth/types";
import { PrismaService } from "../prisma/prisma.service";

type ImportSheetKey =
  | "Categories"
  | "Items"
  | "Locations"
  | "Reason Codes"
  | "Recipe Lines"
  | "Recipes"
  | "Suppliers"
  | "UOM Conversions"
  | "UOMs";

type ImportError = {
  errors: string[];
  row: number;
  sheet: ImportSheetKey;
  values: Record<string, string>;
};

type ImportResult = {
  created: number;
  errorReportBase64: string | null;
  errorReportFilename: string | null;
  errors: ImportError[];
  failed: number;
  imported: number;
  updated: number;
};

type RequestAuditMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

const templateSheets: Array<{
  headers: string[];
  key: ImportSheetKey;
  sample: Record<string, string>;
}> = [
  {
    key: "UOMs",
    headers: ["code", "name", "active"],
    sample: { active: "TRUE", code: "KG", name: "Kilogram" },
  },
  {
    key: "Categories",
    headers: ["name", "active"],
    sample: { active: "TRUE", name: "Raw Materials" },
  },
  {
    key: "Suppliers",
    headers: [
      "name",
      "contactName",
      "email",
      "phone",
      "paymentTerms",
      "active",
    ],
    sample: {
      active: "TRUE",
      contactName: "Juan Dela Cruz",
      email: "supplier@example.com",
      name: "ABC Supplier",
      paymentTerms: "Net 30",
      phone: "+63 900 000 0000",
    },
  },
  {
    key: "Locations",
    headers: ["code", "name", "type", "active"],
    sample: {
      active: "TRUE",
      code: "WH-MAIN",
      name: "Main Warehouse",
      type: "WAREHOUSE",
    },
  },
  {
    key: "Reason Codes",
    headers: ["code", "name", "type", "active"],
    sample: {
      active: "TRUE",
      code: "DAMAGED",
      name: "Damaged Item",
      type: "WASTAGE",
    },
  },
  {
    key: "Items",
    headers: [
      "sku",
      "name",
      "itemType",
      "categoryName",
      "baseUomCode",
      "lowStockThreshold",
      "looseCountEnabled",
      "looseWholeUomCode",
      "looseWholeUnitQty",
      "looseRemainderUomCode",
      "active",
    ],
    sample: {
      active: "TRUE",
      baseUomCode: "KG",
      categoryName: "Raw Materials",
      itemType: "RAW_MATERIAL",
      looseCountEnabled: "FALSE",
      looseRemainderUomCode: "",
      looseWholeUnitQty: "",
      looseWholeUomCode: "",
      lowStockThreshold: "10",
      name: "Chicken Breast",
      sku: "CHICKEN-BREAST",
    },
  },
  {
    key: "UOM Conversions",
    headers: ["fromUomCode", "toUomCode", "factor"],
    sample: { factor: "0.001", fromUomCode: "G", toUomCode: "KG" },
  },
  {
    key: "Recipes",
    headers: [
      "outputSku",
      "version",
      "servingQty",
      "yieldPercent",
      "yieldOverrideReason",
      "wastageFactor",
      "wastageOverrideReason",
      "active",
    ],
    sample: {
      active: "TRUE",
      outputSku: "FRIED-CHICKEN",
      servingQty: "1",
      version: "1",
      wastageFactor: "0",
      wastageOverrideReason: "",
      yieldOverrideReason: "",
      yieldPercent: "100",
    },
  },
  {
    key: "Recipe Lines",
    headers: ["outputSku", "version", "ingredientSku", "qty", "uomCode"],
    sample: {
      ingredientSku: "CHICKEN-BREAST",
      outputSku: "FRIED-CHICKEN",
      qty: "0.25",
      uomCode: "KG",
      version: "1",
    },
  },
];

const sheetOrder: ImportSheetKey[] = [
  "UOMs",
  "Categories",
  "Suppliers",
  "Locations",
  "Reason Codes",
  "Items",
  "UOM Conversions",
  "Recipes",
];

@Injectable()
export class MasterDataImportService {
  constructor(private readonly prisma: PrismaService) {}

  async templateWorkbook() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "OGFI Inventory";
    workbook.created = new Date();

    const instructions = workbook.addWorksheet("Instructions");
    instructions.columns = [{ width: 34 }, { width: 110 }];
    [
      ["Purpose", "Use this workbook to create or update Master Data records."],
      [
        "Import behavior",
        "Valid rows are imported. Invalid rows are skipped and returned in an error workbook.",
      ],
      [
        "Create/update matching",
        "Records are matched by stable business keys: SKU, UOM code, location code, category name, supplier name, reason type+code, and recipe output SKU+version.",
      ],
      [
        "Active column",
        "Use TRUE or FALSE. Blank active values default to TRUE for imported records.",
      ],
      [
        "Recipes",
        "Fill Recipes for the header and Recipe Lines for ingredients. Recipe imports require at least one valid line.",
      ],
      [
        "Do",
        "Keep row 1 headers unchanged. Use codes exactly as entered in related sheets.",
      ],
      [
        "Do not",
        "Do not rename sheets, remove required columns, or use database IDs.",
      ],
    ].forEach((row) => instructions.addRow(row));
    this.styleHeader(instructions.getRow(1));

    for (const sheet of templateSheets) {
      const worksheet = workbook.addWorksheet(sheet.key);
      worksheet.columns = sheet.headers.map((header) => ({
        header,
        key: header,
        width: Math.max(16, header.length + 4),
      }));
      worksheet.addRow(sheet.sample);
      this.styleHeader(worksheet.getRow(1));
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async importWorkbook(
    buffer: Buffer,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata,
  ): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();

    try {
      await workbook.xlsx.load(
        buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
      );
    } catch {
      throw new BadRequestException("Upload a valid .xlsx workbook.");
    }

    const rowsBySheet = this.readWorkbook(workbook);
    const errors: ImportError[] = [];
    const counters = { created: 0, imported: 0, updated: 0 };

    for (const sheet of sheetOrder) {
      if (sheet === "Recipes") {
        const result = await this.importRecipes(
          rowsBySheet["Recipes"] ?? [],
          rowsBySheet["Recipe Lines"] ?? [],
          errors,
          user,
        );
        counters.created += result.created;
        counters.imported += result.imported;
        counters.updated += result.updated;
        continue;
      }
      if (sheet === "Recipe Lines") {
        continue;
      }

      for (const row of rowsBySheet[sheet] ?? []) {
        const beforeErrors = errors.length;
        try {
          const action = await this.importRow(sheet, row.values, user);
          counters[action] += 1;
          counters.imported += 1;
        } catch (error) {
          errors.push({
            ...row,
            errors: [error instanceof Error ? error.message : "Import failed."],
          });
        }

        if (errors.length > beforeErrors) {
          continue;
        }
      }
    }

    await this.prisma.auditLog.create({
      data: {
        action: "master-data.import",
        after: {
          created: counters.created,
          failed: errors.length,
          imported: counters.imported,
          updated: counters.updated,
        },
        entityId: user.id,
        entityType: "MasterDataImport",
        ipAddress: metadata.ipAddress,
        module: "master-data",
        userAgent: metadata.userAgent,
        userId: user.id,
      },
    });

    const errorReport = errors.length
      ? await this.errorWorkbook(errors)
      : null;

    return {
      ...counters,
      errorReportBase64: errorReport?.toString("base64") ?? null,
      errorReportFilename: errorReport
        ? `OGFI_Master_Data_Import_Errors_${formatDateForFilename(new Date())}.xlsx`
        : null,
      errors,
      failed: errors.length,
    };
  }

  private readWorkbook(workbook: ExcelJS.Workbook) {
    const rowsBySheet: Partial<
      Record<
        ImportSheetKey,
        Array<{ row: number; sheet: ImportSheetKey; values: Record<string, string> }>
      >
    > = {};

    for (const sheet of templateSheets) {
      const worksheet = workbook.getWorksheet(sheet.key);
      if (!worksheet) {
        rowsBySheet[sheet.key] = [];
        continue;
      }

      const headers = this.headersFromWorksheet(worksheet);
      rowsBySheet[sheet.key] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber < 2) {
          return;
        }

        const values = Object.fromEntries(
          headers.map((header, index) => [
            header,
            this.cellText(row.getCell(index + 1)),
          ]),
        );

        if (Object.values(values).every((value) => !value.trim())) {
          return;
        }

        rowsBySheet[sheet.key]!.push({
          row: rowNumber,
          sheet: sheet.key,
          values,
        });
      });
    }

    return rowsBySheet;
  }

  private headersFromWorksheet(worksheet: ExcelJS.Worksheet) {
    const headers: string[] = [];
    worksheet.getRow(1).eachCell((cell) => {
      const value = this.cellText(cell).trim();
      if (value && value !== "errors" && value !== "errorMessages") {
        headers.push(value);
      }
    });
    return headers;
  }

  private async importRow(
    sheet: Exclude<ImportSheetKey, "Recipe Lines" | "Recipes">,
    values: Record<string, string>,
    user: AuthenticatedUser,
  ): Promise<"created" | "updated"> {
    switch (sheet) {
      case "Categories":
        return this.importCategory(values);
      case "Items":
        return this.importItem(values);
      case "Locations":
        return this.importLocation(values);
      case "Reason Codes":
        return this.importReasonCode(values);
      case "Suppliers":
        return this.importSupplier(values);
      case "UOM Conversions":
        return this.importUomConversion(values);
      case "UOMs":
        return this.importUom(values);
    }
  }

  private async importUom(values: Record<string, string>) {
    const code = this.code(values.code, "code");
    const existing = await this.prisma.uom.findUnique({ where: { code } });
    await this.prisma.uom.upsert({
      create: {
        active: this.boolean(values.active, true),
        code,
        name: this.required(values.name, "name"),
      },
      update: {
        active: this.boolean(values.active, existing?.active ?? true),
        name: this.required(values.name, "name"),
      },
      where: { code },
    });
    return existing ? "updated" : "created";
  }

  private async importCategory(values: Record<string, string>) {
    const name = this.required(values.name, "name");
    const existing = await this.prisma.category.findUnique({ where: { name } });
    await this.prisma.category.upsert({
      create: { active: this.boolean(values.active, true), name },
      update: { active: this.boolean(values.active, existing?.active ?? true) },
      where: { name },
    });
    return existing ? "updated" : "created";
  }

  private async importSupplier(values: Record<string, string>) {
    const name = this.required(values.name, "name");
    const existing = await this.prisma.supplier.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    const data = {
      active: this.boolean(values.active, existing?.active ?? true),
      contactName: this.optional(values.contactName),
      email: this.optional(values.email)?.toLowerCase(),
      name,
      paymentTerms: this.optional(values.paymentTerms),
      phone: this.optional(values.phone),
    };

    if (existing) {
      await this.prisma.supplier.update({ data, where: { id: existing.id } });
      return "updated";
    }

    await this.prisma.supplier.create({ data });
    return "created";
  }

  private async importLocation(values: Record<string, string>) {
    const code = this.code(values.code, "code");
    const type = this.enumValue(LocationType, values.type, "type");
    const existing = await this.prisma.location.findUnique({ where: { code } });
    await this.prisma.location.upsert({
      create: {
        active: this.boolean(values.active, true),
        code,
        name: this.required(values.name, "name"),
        type,
      },
      update: {
        active: this.boolean(values.active, existing?.active ?? true),
        name: this.required(values.name, "name"),
        type,
      },
      where: { code },
    });
    return existing ? "updated" : "created";
  }

  private async importReasonCode(values: Record<string, string>) {
    const code = this.code(values.code, "code");
    const type = this.enumValue(ReasonCodeType, values.type, "type");
    const existing = await this.prisma.reasonCode.findUnique({
      where: { type_code: { code, type } },
    });
    await this.prisma.reasonCode.upsert({
      create: {
        active: this.boolean(values.active, true),
        code,
        name: this.required(values.name, "name"),
        type,
      },
      update: {
        active: this.boolean(values.active, existing?.active ?? true),
        name: this.required(values.name, "name"),
      },
      where: { type_code: { code, type } },
    });
    return existing ? "updated" : "created";
  }

  private async importItem(values: Record<string, string>) {
    const sku = this.code(values.sku, "sku");
    const baseUom = await this.findUom(values.baseUomCode, "baseUomCode");
    const category = values.categoryName.trim()
      ? await this.findCategory(values.categoryName)
      : null;
    const looseCountEnabled = this.boolean(values.looseCountEnabled, false);
    const looseWholeUom = looseCountEnabled
      ? await this.findUom(values.looseWholeUomCode, "looseWholeUomCode")
      : null;
    const looseRemainderUom = looseCountEnabled
      ? await this.findUom(values.looseRemainderUomCode, "looseRemainderUomCode")
      : null;
    const looseWholeUnitQty = looseCountEnabled
      ? this.positiveNumber(values.looseWholeUnitQty, "looseWholeUnitQty")
      : null;
    const existing = await this.prisma.item.findUnique({ where: { sku } });
    const data = {
      active: this.boolean(values.active, existing?.active ?? true),
      baseUomId: baseUom.id,
      categoryId: category?.id ?? null,
      itemType: this.enumValue(ItemType, values.itemType, "itemType"),
      looseCountEnabled,
      looseRemainderUomId: looseRemainderUom?.id ?? null,
      looseWholeUnitQty:
        looseWholeUnitQty === null ? null : new Prisma.Decimal(looseWholeUnitQty),
      looseWholeUomId: looseWholeUom?.id ?? null,
      lowStockThreshold: values.lowStockThreshold.trim()
        ? new Prisma.Decimal(this.nonNegativeNumber(values.lowStockThreshold, "lowStockThreshold"))
        : null,
      name: this.required(values.name, "name"),
      sku,
    };

    if (existing) {
      await this.prisma.item.update({ data, where: { id: existing.id } });
      return "updated";
    }

    await this.prisma.item.create({ data });
    return "created";
  }

  private async importUomConversion(values: Record<string, string>) {
    const fromUom = await this.findUom(values.fromUomCode, "fromUomCode");
    const toUom = await this.findUom(values.toUomCode, "toUomCode");
    if (fromUom.id === toUom.id) {
      throw new Error("fromUomCode and toUomCode must be different.");
    }
    const existing = await this.prisma.uomConversion.findUnique({
      where: { fromUomId_toUomId: { fromUomId: fromUom.id, toUomId: toUom.id } },
    });
    await this.prisma.uomConversion.upsert({
      create: {
        factor: new Prisma.Decimal(this.positiveNumber(values.factor, "factor")),
        fromUomId: fromUom.id,
        toUomId: toUom.id,
      },
      update: {
        factor: new Prisma.Decimal(this.positiveNumber(values.factor, "factor")),
      },
      where: { fromUomId_toUomId: { fromUomId: fromUom.id, toUomId: toUom.id } },
    });
    return existing ? "updated" : "created";
  }

  private async importRecipes(
    recipeRows: Array<{ row: number; sheet: ImportSheetKey; values: Record<string, string> }>,
    lineRows: Array<{ row: number; sheet: ImportSheetKey; values: Record<string, string> }>,
    errors: ImportError[],
    user: AuthenticatedUser,
  ) {
    const counters = { created: 0, imported: 0, updated: 0 };
    const linesByRecipe = new Map<string, typeof lineRows>();
    const validRecipeRows: Array<{
      key: string;
      row: (typeof recipeRows)[number];
    }> = [];

    for (const line of lineRows) {
      const key = this.tryRecipeKey(line, errors);
      if (!key) {
        continue;
      }
      linesByRecipe.set(key, [...(linesByRecipe.get(key) ?? []), line]);
    }

    const recipeKeys = new Set<string>();
    for (const row of recipeRows) {
      const key = this.tryRecipeKey(row, errors);
      if (!key) {
        continue;
      }
      recipeKeys.add(key);
      validRecipeRows.push({ key, row });
    }

    for (const [key, lines] of linesByRecipe.entries()) {
      if (!recipeKeys.has(key)) {
        for (const line of lines) {
          errors.push({
            ...line,
            errors: ["Recipe Lines row has no matching Recipes row."],
          });
        }
      }
    }

    for (const { key, row: recipeRow } of validRecipeRows) {
      const relatedLines = linesByRecipe.get(key) ?? [];
      try {
        const action = await this.importRecipe(recipeRow.values, relatedLines, user);
        counters[action] += 1;
        counters.imported += 1 + relatedLines.length;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Recipe import failed.";
        errors.push({ ...recipeRow, errors: [message] });
        for (const line of relatedLines) {
          errors.push({ ...line, errors: [`Recipe was not imported: ${message}`] });
        }
      }
    }

    return counters;
  }

  private tryRecipeKey(
    row: { row: number; sheet: ImportSheetKey; values: Record<string, string> },
    errors: ImportError[],
  ) {
    try {
      return this.recipeKey(row.values.outputSku, row.values.version);
    } catch (error) {
      errors.push({
        ...row,
        errors: [error instanceof Error ? error.message : "Invalid recipe key."],
      });
      return null;
    }
  }

  private async importRecipe(
    values: Record<string, string>,
    lineRows: Array<{ values: Record<string, string> }>,
    user: AuthenticatedUser,
  ) {
    const outputItem = await this.findItem(values.outputSku, "outputSku");
    const version = this.integer(values.version || "1", "version");
    if (lineRows.length === 0) {
      throw new Error("Recipe requires at least one Recipe Lines row.");
    }

    const lines = [];
    const ingredientSkus = new Set<string>();
    for (const line of lineRows) {
      const ingredientSku = this.code(line.values.ingredientSku, "ingredientSku");
      if (ingredientSkus.has(ingredientSku)) {
        throw new Error(`Recipe has duplicate ingredientSku ${ingredientSku}.`);
      }
      ingredientSkus.add(ingredientSku);
      const ingredient = await this.findItem(ingredientSku, "ingredientSku");
      if (ingredient.id === outputItem.id) {
        throw new Error("Recipe output item cannot also be an ingredient.");
      }
      const uom = await this.findUom(line.values.uomCode, "uomCode");
      await this.assertRecipeConversion(ingredient, uom.id);
      lines.push({
        ingredientId: ingredient.id,
        qty: new Prisma.Decimal(this.positiveNumber(line.values.qty, "qty")),
        uomId: uom.id,
      });
    }

    const yieldPercent = values.yieldPercent.trim()
      ? this.positiveNumber(values.yieldPercent, "yieldPercent")
      : 100;
    const wastageFactor = values.wastageFactor.trim()
      ? this.nonNegativeNumber(values.wastageFactor, "wastageFactor")
      : 0;
    if (yieldPercent !== 100 && !values.yieldOverrideReason.trim()) {
      throw new Error("yieldOverrideReason is required when yieldPercent is not 100.");
    }
    if (wastageFactor > 0 && !values.wastageOverrideReason.trim()) {
      throw new Error("wastageOverrideReason is required when wastageFactor is greater than 0.");
    }

    const existing = await this.prisma.recipe.findUnique({
      where: { outputItemId_version: { outputItemId: outputItem.id, version } },
    });
    const now = new Date();
    const data = {
      active: this.boolean(values.active, existing?.active ?? true),
      outputItemId: outputItem.id,
      servingQty: new Prisma.Decimal(this.positiveNumber(values.servingQty, "servingQty")),
      version,
      wastageFactor: new Prisma.Decimal(wastageFactor),
      wastageOverrideApprovedAt: wastageFactor > 0 ? now : null,
      wastageOverrideApprovedById: wastageFactor > 0 ? user.id : null,
      wastageOverrideReason: wastageFactor > 0 ? values.wastageOverrideReason.trim() : null,
      wastageOverriddenAt: wastageFactor > 0 ? now : null,
      wastageOverriddenById: wastageFactor > 0 ? user.id : null,
      yieldOverrideApprovedAt: yieldPercent !== 100 ? now : null,
      yieldOverrideApprovedById: yieldPercent !== 100 ? user.id : null,
      yieldOverrideReason: yieldPercent !== 100 ? values.yieldOverrideReason.trim() : null,
      yieldOverriddenAt: yieldPercent !== 100 ? now : null,
      yieldOverriddenById: yieldPercent !== 100 ? user.id : null,
      yieldPercent: new Prisma.Decimal(yieldPercent),
    };

    if (existing) {
      await this.prisma.recipe.update({
        where: { id: existing.id },
        data: { ...data, lines: { create: lines, deleteMany: {} } },
      });
      return "updated";
    }

    await this.prisma.recipe.create({
      data: { ...data, lines: { create: lines } },
    });
    return "created";
  }

  private async errorWorkbook(errors: ImportError[]) {
    const workbook = new ExcelJS.Workbook();
    const instructions = workbook.addWorksheet("Instructions");
    instructions.addRow(["Purpose", "Correct these failed rows and upload this workbook again."]);
    instructions.addRow(["Note", "Rows without errors were already imported and are not included here."]);
    this.styleHeader(instructions.getRow(1));

    for (const template of templateSheets) {
      const sheetErrors = errors.filter((error) => error.sheet === template.key);
      if (sheetErrors.length === 0) {
        continue;
      }

      const worksheet = workbook.addWorksheet(template.key);
      const headers = [...template.headers, "errorMessages"];
      worksheet.columns = headers.map((header) => ({
        header,
        key: header,
        width: Math.max(18, header.length + 4),
      }));
      this.styleHeader(worksheet.getRow(1));
      for (const error of sheetErrors) {
        worksheet.addRow({
          ...error.values,
          errorMessages: error.errors.join("; "),
        });
      }
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private async findUom(codeValue: string, label: string) {
    const code = this.code(codeValue, label);
    const uom = await this.prisma.uom.findFirst({
      where: { active: true, code },
    });
    if (!uom) {
      throw new Error(`${label} ${code} does not exist or is inactive.`);
    }
    return uom;
  }

  private async findCategory(nameValue: string) {
    const name = this.required(nameValue, "categoryName");
    const category = await this.prisma.category.findFirst({
      where: { active: true, name: { equals: name, mode: "insensitive" } },
    });
    if (!category) {
      throw new Error(`categoryName ${name} does not exist or is inactive.`);
    }
    return category;
  }

  private async findItem(skuValue: string, label: string) {
    const sku = this.code(skuValue, label);
    const item = await this.prisma.item.findFirst({
      where: { active: true, sku },
      select: { baseUomId: true, id: true, sku: true },
    });
    if (!item) {
      throw new Error(`${label} ${sku} does not exist or is inactive.`);
    }
    return item;
  }

  private async assertRecipeConversion(
    ingredient: { baseUomId: string; sku: string },
    uomId: string,
  ) {
    if (ingredient.baseUomId === uomId) {
      return;
    }

    const conversion = await this.prisma.uomConversion.findUnique({
      where: {
        fromUomId_toUomId: { fromUomId: uomId, toUomId: ingredient.baseUomId },
      },
    });
    if (!conversion) {
      throw new Error(`Missing UOM conversion for recipe ingredient ${ingredient.sku}.`);
    }
  }

  private cellText(cell: ExcelJS.Cell) {
    const value = cell.value;
    if (value === null || value === undefined) {
      return "";
    }
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    if (typeof value === "object") {
      if ("text" in value && value.text) {
        return String(value.text);
      }
      if ("result" in value && value.result !== undefined) {
        return String(value.result);
      }
      if ("richText" in value && Array.isArray(value.richText)) {
        return value.richText.map((part) => part.text).join("");
      }
      return String(cell.text ?? "");
    }
    return String(value);
  }

  private required(value: string | undefined, label: string) {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) {
      throw new Error(`${label} is required.`);
    }
    return trimmed;
  }

  private optional(value: string | undefined) {
    const trimmed = value?.trim() ?? "";
    return trimmed || null;
  }

  private code(value: string | undefined, label: string) {
    return this.required(value, label).toUpperCase().replace(/\s+/g, "-");
  }

  private boolean(value: string | undefined, fallback: boolean) {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) {
      return fallback;
    }
    if (["1", "true", "yes", "y"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "n"].includes(normalized)) {
      return false;
    }
    throw new Error(`${value} is not a valid TRUE/FALSE value.`);
  }

  private enumValue<T extends Record<string, string>>(
    enumObject: T,
    value: string | undefined,
    label: string,
  ) {
    const normalized = this.required(value, label).toUpperCase().replace(/\s+/g, "_");
    if (Object.values(enumObject).includes(normalized)) {
      return normalized as T[keyof T];
    }
    throw new Error(`${label} must be one of: ${Object.values(enumObject).join(", ")}.`);
  }

  private positiveNumber(value: string | undefined, label: string) {
    const parsed = Number(this.required(value, label));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`${label} must be greater than zero.`);
    }
    return parsed;
  }

  private nonNegativeNumber(value: string | undefined, label: string) {
    const parsed = Number(this.required(value, label));
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`${label} must be zero or greater.`);
    }
    return parsed;
  }

  private integer(value: string | undefined, label: string) {
    const parsed = this.positiveNumber(value, label);
    if (!Number.isInteger(parsed)) {
      throw new Error(`${label} must be a whole number.`);
    }
    return parsed;
  }

  private recipeKey(outputSku: string | undefined, version: string | undefined) {
    return `${this.code(outputSku, "outputSku")}::${this.integer(version || "1", "version")}`;
  }

  private styleHeader(row: ExcelJS.Row) {
    row.font = { bold: true };
    row.fill = {
      fgColor: { argb: "FFE6F4EA" },
      pattern: "solid",
      type: "pattern",
    };
  }
}

function formatDateForFilename(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
}
