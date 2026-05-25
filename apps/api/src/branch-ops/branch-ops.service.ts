import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CountStatus,
  DocumentStatus,
  Prisma,
  ReasonCodeType,
  ReferenceType,
  StockCountType,
  TransactionType,
  TransferStatus,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { AuthenticatedUser } from "../auth/types";
import { nextBusinessDocumentNumber } from "../common/document-numbering";
import { CostingService } from "../costing/costing.service";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateEmergencyPurchaseDto,
  CreateIssueToOpsDto,
  CreateSalesBatchDto,
  CreateWastageDto,
  SubmitStockCountDto,
} from "./dto/branch-ops.dto";

type RequestAuditMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

type QtyLine = {
  itemId: string;
  uomId: string;
  qty: number;
};

type EmergencyPurchaseLine = QtyLine & {
  brand?: string;
  unitCost: number;
};

type CountLine = {
  itemId: string;
  uomId: string;
  countedQty: number;
  looseRemainderQty?: number;
  looseWholeUnits?: number;
};

type SalesLine = {
  itemId: string;
  uomId: string;
  qtySold: number;
};

@Injectable()
export class BranchOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly costingService: CostingService,
  ) {}

  list(
    resource: string,
    query?: Record<string, string>,
    user?: AuthenticatedUser,
  ) {
    switch (resource) {
      case "wastage":
        return this.listWastage(query, user);
      case "stock-counts":
        return this.listStockCounts(query, user);
      case "stock-counts.detail":
        return this.getStockCount(query?.id, user);
      case "issues":
        return this.listIssues(query, user);
      case "emergency-purchases":
        return this.listEmergencyPurchases(query, user);
      case "sales-batches":
        return this.listSalesBatches(query, user);
      default:
        throw new NotFoundException("Branch operations resource not found.");
    }
  }

  async createWastage(
    dto: CreateWastageDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    this.assertUserCanAccessLocation(user, dto.locationId);
    this.assertUniqueItems(dto.lines);
    const lines = await this.normalizeQtyLines(dto.lines);

    const lineCosts = await this.validateOutboundStock(
      dto.locationId,
      lines,
      "Insufficient stock to post wastage.",
    );

    const wastage = await this.prisma.$transaction(async (tx) => {
      await this.validateLocationAndItems(
        tx,
        dto.locationId,
        lines.map((line) => line.itemId),
      );

      const reasonCode = await tx.reasonCode.findFirst({
        where: {
          id: dto.reasonCodeId,
          active: true,
          type: ReasonCodeType.WASTAGE,
        },
        select: { id: true },
      });

      if (!reasonCode) {
        throw new BadRequestException(
          "Wastage reason code does not exist or is inactive.",
        );
      }

      const created = await tx.wastage.create({
        data: {
          wastageNumber: await this.nextDocumentNumber(tx, "WA", "wastage"),
          locationId: dto.locationId,
          reasonCodeId: dto.reasonCodeId,
          status: CountStatus.POSTED,
          businessDate: new Date(dto.businessDate),
          remarks: dto.remarks,
          lines: {
            create: lines.map((line) => ({
              itemId: line.itemId,
              qty: line.qty,
              unitCost: lineCosts.get(line.itemId) ?? 0,
            })),
          },
        },
        include: wastageInclude,
      });

      await this.recordAudit(
        tx,
        "branch.wastage.posted",
        "Wastage",
        created,
        user,
        metadata,
      );

      for (const line of lines) {
        await this.ledgerService.postEventInTransaction(
          tx,
          {
            uuid: randomUUID(),
            locationId: dto.locationId,
            itemId: line.itemId,
            transactionType: TransactionType.WASTAGE,
            qtyOut: line.qty,
            unitCostAtTime: Number(lineCosts.get(line.itemId) ?? 0),
            referenceType: ReferenceType.WASTAGE,
            referenceId: created.id,
            businessDate: dto.businessDate,
            reasonCodeId: dto.reasonCodeId,
            metadata: { wastageNumber: created.wastageNumber },
          },
          user,
          metadata,
        );
      }

      return created;
    });

    return this.toResponse(wastage);
  }

  async submitStockCount(
    dto: SubmitStockCountDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    this.assertUserCanAccessLocation(user, dto.locationId);
    this.validateStoreCountType(dto.countType);
    this.assertUniqueItems(dto.lines);
    const lines = await this.normalizeCountLines(dto.lines);

    const systemQtyByItem = await this.currentQtyByItem(
      dto.locationId,
      lines.map((line) => line.itemId),
    );

    const stockCount = await this.prisma.$transaction(async (tx) => {
      await this.validateLocationAndItems(
        tx,
        dto.locationId,
        lines.map((line) => line.itemId),
      );
      await this.assertStockCountNotDuplicate(
        tx,
        dto.locationId,
        dto.countType,
        dto.businessDate,
      );

      const created = await tx.stockCount.create({
        data: {
          countNumber: await this.nextDocumentNumber(tx, "SC", "stockCount"),
          locationId: dto.locationId,
          countType: dto.countType,
          status: CountStatus.POSTED,
          businessDate: new Date(dto.businessDate),
          submittedAt: new Date(),
          approvedAt: new Date(),
          lines: {
            create: lines.map((line) => {
              const systemQty =
                systemQtyByItem.get(line.itemId) ?? new Prisma.Decimal(0);
              const countedQty = new Prisma.Decimal(line.countedQty);

              return {
                itemId: line.itemId,
                countedQty,
                systemQty,
                varianceQty: countedQty.sub(systemQty),
              };
            }),
          },
        },
        include: stockCountInclude,
      });

      await this.recordAudit(
        tx,
        "branch.stock-counts.posted",
        "StockCount",
        created,
        user,
        metadata,
      );

      for (const line of created.lines) {
        const varianceQty = new Prisma.Decimal(line.varianceQty ?? 0);

        if (varianceQty.eq(0)) {
          continue;
        }

        await this.ledgerService.postEventInTransaction(
          tx,
          {
            uuid: randomUUID(),
            locationId: dto.locationId,
            itemId: line.itemId,
            transactionType: TransactionType.STOCK_COUNT,
            qtyIn: varianceQty.gt(0) ? varianceQty.toNumber() : undefined,
            qtyOut: varianceQty.lt(0) ? varianceQty.abs().toNumber() : undefined,
            unitCostAtTime: 0,
            referenceType: ReferenceType.COUNT,
            referenceId: created.id,
            businessDate: dto.businessDate,
            metadata: { countNumber: created.countNumber },
          },
          user,
          metadata,
        );
      }

      return created;
    });

    return this.toResponse(stockCount);
  }

  async createIssueToOps(
    dto: CreateIssueToOpsDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    this.assertUserCanAccessLocation(user, dto.locationId);
    this.assertUniqueItems(dto.lines);
    const lines = await this.normalizeQtyLines(dto.lines);

    const lineCosts = await this.validateOutboundStock(
      dto.locationId,
      lines,
      "Insufficient stock to issue to operations.",
    );

    const issue = await this.prisma.$transaction(async (tx) => {
      await this.validateLocationAndItems(
        tx,
        dto.locationId,
        lines.map((line) => line.itemId),
      );

      const created = await tx.issueToOps.create({
        data: {
          issueNumber: await this.nextDocumentNumber(tx, "IO", "issueToOps"),
          locationId: dto.locationId,
          businessDate: new Date(dto.businessDate),
          remarks: dto.remarks,
          lines: {
            create: lines.map((line) => ({
              itemId: line.itemId,
              qty: line.qty,
              unitCost: lineCosts.get(line.itemId) ?? 0,
            })),
          },
        },
        include: issueInclude,
      });

      await this.recordAudit(
        tx,
        "branch.issues.posted",
        "IssueToOps",
        created,
        user,
        metadata,
      );

      for (const line of lines) {
        await this.ledgerService.postEventInTransaction(
          tx,
          {
            uuid: randomUUID(),
            locationId: dto.locationId,
            itemId: line.itemId,
            transactionType: TransactionType.ISSUE_TO_OPS,
            qtyOut: line.qty,
            unitCostAtTime: Number(lineCosts.get(line.itemId) ?? 0),
            referenceType: ReferenceType.ISSUE,
            referenceId: created.id,
            businessDate: dto.businessDate,
            metadata: { issueNumber: created.issueNumber },
          },
          user,
          metadata,
        );
      }

      return created;
    });

    return this.toResponse(issue);
  }

  async createEmergencyPurchase(
    dto: CreateEmergencyPurchaseDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    this.assertUserCanAccessLocation(user, dto.locationId);
    this.assertUniqueItems(dto.lines);
    const lines = await this.normalizeEmergencyPurchaseLines(dto.lines);

    const emergencyPurchase = await this.prisma.$transaction(async (tx) => {
      await this.validateLocationAndItems(
        tx,
        dto.locationId,
        lines.map((line) => line.itemId),
      );

      const created = await tx.emergencyPurchase.create({
        data: {
          purchaseNumber: await this.nextDocumentNumber(
            tx,
            "EP",
            "emergencyPurchase",
          ),
          locationId: dto.locationId,
          status: DocumentStatus.POSTED,
          businessDate: new Date(dto.businessDate),
          sourceName: dto.sourceName.trim(),
          receiptReference: dto.receiptReference?.trim() || undefined,
          reason: dto.reason?.trim() || undefined,
          remarks: dto.remarks?.trim() || undefined,
          lines: {
            create: lines.map((line) => ({
              itemId: line.itemId,
              uomId: line.uomId,
              qty: line.qty,
              unitCost: line.unitCost,
              brand: line.brand?.trim() || undefined,
            })),
          },
        },
        include: emergencyPurchaseInclude,
      });

      await this.recordAudit(
        tx,
        "branch.emergency-purchases.posted",
        "EmergencyPurchase",
        created,
        user,
        metadata,
      );

      for (const line of lines) {
        await this.ledgerService.postEventInTransaction(
          tx,
          {
            uuid: randomUUID(),
            locationId: dto.locationId,
            itemId: line.itemId,
            transactionType: TransactionType.RECEIVE,
            qtyIn: line.qty,
            unitCostAtTime: line.unitCost,
            referenceType: ReferenceType.EMERGENCY_PURCHASE,
            referenceId: created.id,
            businessDate: dto.businessDate,
            metadata: {
              purchaseNumber: created.purchaseNumber,
              sourceName: created.sourceName,
              receiptReference: created.receiptReference,
              brand: line.brand,
            },
          },
          user,
          metadata,
        );
      }

      return created;
    });

    return this.toResponse(emergencyPurchase);
  }

  async createSalesBatch(
    dto: CreateSalesBatchDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    this.assertUserCanAccessLocation(user, dto.locationId);
    this.assertUniqueSalesItems(dto.lines);
    const salesLines = await this.normalizeSalesLines(dto.lines);

    const consumptionLines = await this.salesConsumptionLines(salesLines);
    const lineCosts = await this.validateOutboundStock(
      dto.locationId,
      consumptionLines,
      "Insufficient stock to post sales consumption.",
    );

    const salesBatch = await this.prisma.$transaction(async (tx) => {
      await this.validateLocationAndItems(
        tx,
        dto.locationId,
        salesLines.map((line) => line.itemId),
      );

      const created = await tx.salesBatch.create({
        data: {
          batchNumber: await this.nextDocumentNumber(tx, "SB", "salesBatch"),
          locationId: dto.locationId,
          status: DocumentStatus.POSTED,
          businessDate: new Date(dto.businessDate),
          sourceFileUrl: dto.sourceFileUrl,
          lines: {
            create: salesLines.map((line) => ({
              itemId: line.itemId,
              qtySold: line.qtySold,
            })),
          },
        },
        include: salesBatchInclude,
      });

      await this.recordAudit(
        tx,
        "branch.sales-batches.posted",
        "SalesBatch",
        created,
        user,
        metadata,
      );

      for (const line of consumptionLines) {
        await this.ledgerService.postEventInTransaction(
          tx,
          {
            uuid: randomUUID(),
            locationId: dto.locationId,
            itemId: line.itemId,
            transactionType: TransactionType.SALE_CONSUMPTION,
            qtyOut: line.qty,
            unitCostAtTime: Number(lineCosts.get(line.itemId) ?? 0),
            referenceType: ReferenceType.SALES_BATCH,
            referenceId: created.id,
            businessDate: dto.businessDate,
            metadata: { batchNumber: created.batchNumber },
          },
          user,
          metadata,
        );
      }

      return created;
    });

    return this.toResponse(salesBatch);
  }

  private async listWastage(
    query?: Record<string, string>,
    user?: AuthenticatedUser,
  ) {
    const data = await this.prisma.wastage.findMany({
      where: this.locationWhere(query, user),
      include: wastageInclude,
      orderBy: { createdAt: "desc" },
      take: this.parseTake(query?.take),
    });

    return { resource: "branch.wastage", data: this.toResponse(data) };
  }

  private async listStockCounts(
    query?: Record<string, string>,
    user?: AuthenticatedUser,
  ) {
    const data = await this.prisma.stockCount.findMany({
      where: this.locationWhere(query, user),
      include: stockCountInclude,
      orderBy: { createdAt: "desc" },
      take: this.parseTake(query?.take),
    });

    return { resource: "branch.stock-counts", data: this.toResponse(data) };
  }

  private async getStockCount(id?: string, user?: AuthenticatedUser) {
    if (!id) {
      throw new BadRequestException("Stock count id is required.");
    }

    const stockCount = await this.prisma.stockCount.findUnique({
      where: { id },
      include: stockCountInclude,
    });

    if (!stockCount) {
      throw new NotFoundException("Stock count not found.");
    }

    if (user) {
      this.assertUserCanAccessLocation(user, stockCount.locationId);
    }

    return this.toResponse(stockCount);
  }

  private async listIssues(
    query?: Record<string, string>,
    user?: AuthenticatedUser,
  ) {
    const data = await this.prisma.issueToOps.findMany({
      where: this.locationWhere(query, user),
      include: issueInclude,
      orderBy: { createdAt: "desc" },
      take: this.parseTake(query?.take),
    });

    return { resource: "branch.issues", data: this.toResponse(data) };
  }

  private async listEmergencyPurchases(
    query?: Record<string, string>,
    user?: AuthenticatedUser,
  ) {
    const data = await this.prisma.emergencyPurchase.findMany({
      where: this.locationWhere(query, user),
      include: emergencyPurchaseInclude,
      orderBy: { createdAt: "desc" },
      take: this.parseTake(query?.take),
    });

    return {
      resource: "branch.emergency-purchases",
      data: this.toResponse(data),
    };
  }

  private async listSalesBatches(
    query?: Record<string, string>,
    user?: AuthenticatedUser,
  ) {
    const data = await this.prisma.salesBatch.findMany({
      where: this.locationWhere(query, user),
      include: salesBatchInclude,
      orderBy: { createdAt: "desc" },
      take: this.parseTake(query?.take),
    });

    return { resource: "branch.sales-batches", data: this.toResponse(data) };
  }

  private async validateOutboundStock(
    locationId: string,
    lines: Array<{ itemId: string; qty: number }>,
    message: string,
  ) {
    const states = await this.currentStateByItem(
      locationId,
      lines.map((line) => line.itemId),
    );
    const lineCosts = new Map<string, Prisma.Decimal>();

    for (const line of lines) {
      const state = states.get(line.itemId);
      const reservedOutQty = await this.reservedOutQty(locationId, line.itemId);
      const availableQty =
        state?.qtyOnHand.sub(reservedOutQty) ?? new Prisma.Decimal(0);

      if (!state || availableQty.lt(line.qty)) {
        throw new ConflictException(message);
      }

      lineCosts.set(line.itemId, state.averageUnitCost);
    }

    return lineCosts;
  }

  private async reservedOutQty(locationId: string, itemId: string) {
    const lines = await this.prisma.transferLine.findMany({
      where: {
        itemId,
        transfer: {
          sourceLocationId: locationId,
          status: {
            in: [TransferStatus.DISPATCHED, TransferStatus.VARIANCE_REVIEW],
          },
        },
      },
      select: {
        pickedQty: true,
        receivedQty: true,
      },
    });

    return lines.reduce((total, line) => {
      const pickedQty = line.pickedQty ?? new Prisma.Decimal(0);
      const receivedQty = line.receivedQty ?? new Prisma.Decimal(0);
      const unresolvedQty = pickedQty.sub(receivedQty);

      return unresolvedQty.gt(0) ? total.add(unresolvedQty) : total;
    }, new Prisma.Decimal(0));
  }

  private validateStoreCountType(countType: StockCountType) {
    if (
      countType !== StockCountType.OPENING &&
      countType !== StockCountType.EOD
    ) {
      throw new BadRequestException(
        "Store Operations only supports Beginning and EOD counts.",
      );
    }
  }

  private async assertStockCountNotDuplicate(
    tx: Prisma.TransactionClient,
    locationId: string,
    countType: StockCountType,
    businessDate: string,
  ) {
    const where: Prisma.StockCountWhereInput = {
      countType,
      locationId,
      status: CountStatus.POSTED,
    };

    if (countType === StockCountType.EOD) {
      const { start, end } = this.businessDateRange(businessDate);
      where.businessDate = { gte: start, lt: end };
    }

    const existingCount = await tx.stockCount.findFirst({
      where,
      select: { countNumber: true },
    });

    if (!existingCount) {
      return;
    }

    if (countType === StockCountType.OPENING) {
      throw new ConflictException(
        `Opening inventory was already posted for this location as ${existingCount.countNumber}. Reset the location before uploading another opening count.`,
      );
    }

    throw new ConflictException(
      `EOD count was already posted for this location and business date as ${existingCount.countNumber}.`,
    );
  }

  private businessDateRange(value: string) {
    const start = new Date(value);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return { end, start };
  }

  private async currentQtyByItem(locationId: string, itemIds: string[]) {
    const states = await this.currentStateByItem(locationId, itemIds);
    return new Map(
      itemIds.map((itemId) => [
        itemId,
        states.get(itemId)?.qtyOnHand ?? new Prisma.Decimal(0),
      ]),
    );
  }

  private async currentStateByItem(locationId: string, itemIds: string[]) {
    const uniqueItemIds = [...new Set(itemIds)];
    const states = new Map<
      string,
      ReturnType<CostingService["calculateState"]>
    >();

    for (const itemId of uniqueItemIds) {
      const events = await this.prisma.ledgerEvent.findMany({
        where: { locationId, itemId },
        orderBy: [{ businessDate: "asc" }, { createdAt: "asc" }],
      });

      states.set(itemId, this.costingService.calculateState(events));
    }

    return states;
  }

  private async salesConsumptionLines(lines: SalesLine[]) {
    const recipes = await this.prisma.recipe.findMany({
      where: {
        outputItemId: { in: lines.map((line) => line.itemId) },
        active: true,
      },
      include: {
        outputItem: true,
        lines: {
          include: {
            ingredient: true,
          },
        },
      },
      orderBy: [{ outputItemId: "asc" }, { version: "desc" }],
    });

    const recipeByOutput = new Map<string, (typeof recipes)[number]>();

    for (const recipe of recipes) {
      if (!recipeByOutput.has(recipe.outputItemId)) {
        recipeByOutput.set(recipe.outputItemId, recipe);
      }
    }

    const consumption = new Map<string, Prisma.Decimal>();

    for (const salesLine of lines) {
      const recipe = recipeByOutput.get(salesLine.itemId);

      if (!recipe) {
        throw new BadRequestException(
          "Every sales batch item must have an active recipe.",
        );
      }

      for (const recipeLine of recipe.lines) {
        const conversionFactor = await this.recipeConversionFactor(recipeLine);
        const yieldMultiplier = new Prisma.Decimal(100).div(
          recipe.yieldPercent,
        );
        const wastageMultiplier = new Prisma.Decimal(1).add(
          recipe.wastageFactor.div(100),
        );
        const qty = new Prisma.Decimal(salesLine.qtySold)
          .div(recipe.servingQty)
          .mul(recipeLine.qty)
          .mul(conversionFactor)
          .mul(yieldMultiplier)
          .mul(wastageMultiplier);

        consumption.set(
          recipeLine.ingredientId,
          (
            consumption.get(recipeLine.ingredientId) ?? new Prisma.Decimal(0)
          ).add(qty),
        );
      }
    }

    return [...consumption.entries()].map(([itemId, qty]) => ({
      itemId,
      qty: qty.toNumber(),
    }));
  }

  private normalizeQtyLines(lines: QtyLine[]) {
    return Promise.all(
      lines.map(async (line) => ({
        ...line,
        qty: await this.convertToBaseQty(line.itemId, line.uomId, line.qty),
      })),
    );
  }

  private normalizeEmergencyPurchaseLines(lines: EmergencyPurchaseLine[]) {
    return Promise.all(
      lines.map(async (line) => {
        const baseQty = await this.convertToBaseQty(
          line.itemId,
          line.uomId,
          line.qty,
        );
        const baseUnitCost = new Prisma.Decimal(line.unitCost)
          .mul(line.qty)
          .div(baseQty)
          .toNumber();

        return {
          ...line,
          qty: baseQty,
          unitCost: baseUnitCost,
        };
      }),
    );
  }

  private normalizeCountLines(lines: CountLine[]) {
    return Promise.all(
      lines.map(async (line) => ({
        ...line,
        countedQty: await this.countedQtyToBaseQty(line),
      })),
    );
  }

  private async countedQtyToBaseQty(line: CountLine) {
    const hasLooseCount =
      line.looseWholeUnits !== undefined ||
      line.looseRemainderQty !== undefined;

    if (!hasLooseCount) {
      return this.convertToBaseQty(line.itemId, line.uomId, line.countedQty);
    }

    const item = await this.prisma.item.findFirst({
      where: { id: line.itemId, active: true },
      select: {
        looseCountEnabled: true,
        looseRemainderUomId: true,
        looseWholeUnitQty: true,
        sku: true,
      },
    });

    if (!item) {
      throw new BadRequestException("Item does not exist or is inactive.");
    }

    if (
      !item.looseCountEnabled ||
      !item.looseWholeUnitQty ||
      !item.looseRemainderUomId
    ) {
      throw new BadRequestException(
        `Loose count is not configured for ${item.sku}.`,
      );
    }

    const wholeQty = new Prisma.Decimal(line.looseWholeUnits ?? 0).mul(
      item.looseWholeUnitQty,
    );
    const remainderQty = await this.convertToBaseQty(
      line.itemId,
      item.looseRemainderUomId,
      line.looseRemainderQty ?? 0,
    );

    return wholeQty.add(remainderQty).toNumber();
  }

  private normalizeSalesLines(lines: SalesLine[]) {
    return Promise.all(
      lines.map(async (line) => ({
        ...line,
        qtySold: await this.convertToBaseQty(
          line.itemId,
          line.uomId,
          line.qtySold,
        ),
      })),
    );
  }

  private async convertToBaseQty(itemId: string, uomId: string, qty: number) {
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, active: true },
      select: { baseUomId: true, sku: true },
    });

    if (!item) {
      throw new BadRequestException("Item does not exist or is inactive.");
    }

    if (item.baseUomId === uomId) {
      return qty;
    }

    const conversion = await this.prisma.uomConversion.findUnique({
      where: {
        fromUomId_toUomId: {
          fromUomId: uomId,
          toUomId: item.baseUomId,
        },
      },
    });

    if (!conversion) {
      throw new BadRequestException(
        `No UOM conversion exists from selected UOM to base UOM for ${item.sku}.`,
      );
    }

    return new Prisma.Decimal(qty).mul(conversion.factor).toNumber();
  }

  private async recipeConversionFactor(recipeLine: {
    uomId: string;
    ingredient: { baseUomId: string };
  }) {
    if (recipeLine.uomId === recipeLine.ingredient.baseUomId) {
      return new Prisma.Decimal(1);
    }

    const conversion = await this.prisma.uomConversion.findUnique({
      where: {
        fromUomId_toUomId: {
          fromUomId: recipeLine.uomId,
          toUomId: recipeLine.ingredient.baseUomId,
        },
      },
    });

    if (!conversion) {
      throw new BadRequestException(
        "Recipe ingredient UOM must convert to the ingredient base UOM.",
      );
    }

    return conversion.factor;
  }

  private async validateLocationAndItems(
    tx: Prisma.TransactionClient,
    locationId: string,
    itemIds: string[],
  ) {
    const [location, items] = await Promise.all([
      tx.location.findFirst({
        where: { id: locationId, active: true },
        select: { id: true },
      }),
      tx.item.findMany({
        where: { id: { in: itemIds }, active: true },
        select: { id: true },
      }),
    ]);

    if (!location) {
      throw new BadRequestException("Location does not exist or is inactive.");
    }

    const foundItemIds = new Set(items.map((item) => item.id));

    if (itemIds.some((itemId) => !foundItemIds.has(itemId))) {
      throw new BadRequestException(
        "One or more items do not exist or are inactive.",
      );
    }
  }

  private assertUniqueItems(lines: Array<{ itemId: string }>) {
    const itemIds = lines.map((line) => line.itemId);

    if (new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException("Duplicate item lines are not allowed.");
    }
  }

  private assertUniqueSalesItems(lines: Array<{ itemId: string }>) {
    this.assertUniqueItems(lines);
  }

  private assertUserCanAccessLocation(
    user: AuthenticatedUser,
    locationId: string,
  ) {
    if (!user.locationIds.includes(locationId)) {
      throw new ForbiddenException("Location access denied.");
    }
  }

  private locationWhere(
    query?: Record<string, string>,
    user?: AuthenticatedUser,
  ) {
    if (query?.locationId) {
      if (user) {
        this.assertUserCanAccessLocation(user, query.locationId);
      }
      return { locationId: query.locationId };
    }

    return user ? { locationId: { in: user.locationIds } } : {};
  }

  private async nextDocumentNumber(
    tx: Prisma.TransactionClient,
    prefix: string,
    _model:
      | "wastage"
      | "stockCount"
      | "issueToOps"
      | "emergencyPurchase"
      | "salesBatch",
  ) {
    return nextBusinessDocumentNumber(tx, prefix);
  }

  private async recordAudit(
    tx: Prisma.TransactionClient,
    action: string,
    entityType: string,
    entity: { id: string; locationId: string },
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata,
  ) {
    await tx.auditLog.create({
      data: {
        userId: user.id,
        module: "branch",
        action,
        entityType,
        entityId: entity.id,
        locationId: entity.locationId,
        after: this.toJson(entity),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });
  }

  private parseTake(rawTake?: string) {
    if (!rawTake) {
      return 100;
    }

    const take = Number(rawTake);
    return Number.isInteger(take) && take > 0 && take <= 500 ? take : 100;
  }

  private toResponse<T>(value: T): T {
    return this.toJson(value) as T;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(
      JSON.stringify(value, (_key, nestedValue) =>
        nestedValue instanceof Prisma.Decimal
          ? nestedValue.toString()
          : nestedValue,
      ),
    ) as Prisma.InputJsonValue;
  }
}

const itemInclude = {
  baseUom: true,
} satisfies Prisma.ItemInclude;

const wastageInclude = {
  location: true,
  reasonCode: true,
  lines: {
    include: {
      item: { include: itemInclude },
    },
  },
} satisfies Prisma.WastageInclude;

const stockCountInclude = {
  location: true,
  lines: {
    include: {
      item: { include: itemInclude },
    },
  },
} satisfies Prisma.StockCountInclude;

const issueInclude = {
  location: true,
  lines: {
    include: {
      item: { include: itemInclude },
    },
  },
} satisfies Prisma.IssueToOpsInclude;

const emergencyPurchaseInclude = {
  location: true,
  lines: {
    include: {
      item: { include: itemInclude },
      uom: true,
    },
  },
} satisfies Prisma.EmergencyPurchaseInclude;

const salesBatchInclude = {
  location: true,
  lines: {
    include: {
      item: { include: itemInclude },
    },
  },
} satisfies Prisma.SalesBatchInclude;
