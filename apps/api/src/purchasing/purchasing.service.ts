import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DocumentStatus,
  Prisma,
  ReferenceType,
  TransactionType,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { AuthenticatedUser } from "../auth/types";
import { PrismaService } from "../prisma/prisma.service";
import {
  ApprovePurchaseOrderDto,
  ClosePurchaseOrderBalanceDto,
  CreatePurchaseOrderDto,
  CreateReceivingDto,
  RejectPurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from "./dto/purchasing.dto";

interface RequestAuditMetadata {
  ipAddress?: string;
  userAgent?: string;
}

const purchaseOrderInclude = {
  supplier: true,
  location: true,
  lines: {
    include: {
      item: { include: { baseUom: true } },
      supplierItem: {
        include: { item: { include: { baseUom: true } }, purchaseUom: true },
      },
      uom: true,
      costOverriddenBy: {
        select: { id: true, fullName: true, username: true },
      },
      costOverrideApprovedBy: {
        select: { id: true, fullName: true, username: true },
      },
    },
    orderBy: { item: { sku: "asc" } },
  },
} satisfies Prisma.PurchaseOrderInclude;

const receivingInclude = {
  supplier: true,
  location: true,
  purchaseOrder: true,
  lines: {
    include: {
      item: { include: { baseUom: true } },
    },
    orderBy: { item: { sku: "asc" } },
  },
} satisfies Prisma.ReceivingInclude;

@Injectable()
export class PurchasingService {
  constructor(private readonly prisma: PrismaService) {}

  async getSupplierItemCost(
    supplierId?: string,
    itemId?: string,
    supplierItemId?: string,
  ) {
    if (!supplierId || !itemId) {
      throw new BadRequestException("supplierId and itemId are required.");
    }

    const supplierItem = supplierItemId
      ? await this.prisma.supplierItem.findFirst({
          where: { active: true, id: supplierItemId, itemId, supplierId },
          include: { item: { include: { baseUom: true } }, supplier: true },
        })
      : await this.prisma.supplierItem.findFirst({
          where: { active: true, itemId, supplierId },
          include: { item: { include: { baseUom: true } }, supplier: true },
          orderBy: [{ supplierSku: "asc" }, { createdAt: "asc" }],
        });

    if (!supplierItem?.active || !supplierItem.unitCost) {
      return {
        supplierId,
        itemId,
        supplierItemId: supplierItem?.id ?? null,
        unitCost: null,
        brand: supplierItem?.brand ?? null,
        packSize: supplierItem?.packSize ?? null,
        supplierSku: supplierItem?.supplierSku ?? null,
        item: supplierItem?.item ?? null,
        supplier: supplierItem?.supplier ?? null,
      };
    }

    return this.toJson({
      supplierId,
      itemId,
      supplierItemId: supplierItem.id,
      unitCost: supplierItem.unitCost,
      brand: supplierItem.brand,
      packSize: supplierItem.packSize,
      supplierSku: supplierItem.supplierSku,
      item: supplierItem.item,
      supplier: supplierItem.supplier,
    });
  }

  async list(resource: string, query: Record<string, string> = {}) {
    if (resource === "purchase-orders") {
      const purchaseOrders = await this.prisma.purchaseOrder.findMany({
        where: {
          supplierId: query.supplierId,
          locationId: query.locationId,
          status: query.status as DocumentStatus | undefined,
        },
        include: {
          supplier: true,
          location: true,
              lines: {
                include: {
                  item: true,
                  supplierItem: true,
                  uom: true,
                },
          },
          receivings: {
            include: { lines: true },
            orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
          },
          _count: { select: { lines: true, receivings: true } },
        },
        orderBy: [{ createdAt: "desc" }],
        take: this.parseTake(query.take),
      });

      return {
        resource: "purchasing.purchase-orders",
        data: purchaseOrders.map((purchaseOrder) => ({
          ...this.withReceivingTotals(purchaseOrder),
          lineCount: purchaseOrder._count.lines,
          receivingCount: purchaseOrder._count.receivings,
          _count: undefined,
        })),
      };
    }

    if (resource === "purchase-orders.detail") {
      const purchaseOrder = await this.prisma.purchaseOrder.findUnique({
        where: { id: query.id },
        include: {
          ...purchaseOrderInclude,
          receivings: {
            include: { lines: true },
            orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
          },
        },
      });

      if (!purchaseOrder) {
        throw new NotFoundException("Purchase order not found.");
      }

      return this.toPurchaseOrderResponse(purchaseOrder);
    }

    if (resource === "receivings.detail") {
      const receiving = await this.prisma.receiving.findUnique({
        where: { id: query.id },
        include: receivingInclude,
      });

      if (!receiving) {
        throw new NotFoundException("Receiving not found.");
      }

      return this.toReceivingResponse(receiving);
    }

    return {
      resource,
      status: "deferred",
      query,
    };
  }

  async createPurchaseOrder(
    dto: CreatePurchaseOrderDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    this.assertUserCanAccessLocation(user, dto.locationId);

    return this.prisma.$transaction(async (tx) => {
      await this.validatePurchaseOrderTargets(tx, dto);

      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          poNumber: await this.nextDocumentNumber(tx, "PO"),
          supplierId: dto.supplierId,
          locationId: dto.locationId,
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
          remarks: dto.remarks,
          createdById: user.id,
          lines: {
            create: await Promise.all(
              dto.lines.map((line) =>
                this.toPurchaseOrderLineCreateData(
                  tx,
                  dto.supplierId,
                  line,
                  user,
                ),
              ),
            ),
          },
        },
        include: purchaseOrderInclude,
      });

      await this.recordAudit(
        tx,
        "purchase-orders.created",
        purchaseOrder,
        user,
        metadata,
      );

      return this.toPurchaseOrderResponse(purchaseOrder);
    });
  }

  async submitPurchaseOrder(
    id: string,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const purchaseOrder = await this.findPurchaseOrderForUpdate(tx, id);
      this.assertUserCanAccessLocation(user, purchaseOrder.locationId);

      if (purchaseOrder.status !== DocumentStatus.DRAFT) {
        throw new ConflictException(
          "Only draft purchase orders can be submitted.",
        );
      }

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: DocumentStatus.PENDING_APPROVAL,
          submittedAt: new Date(),
        },
        include: purchaseOrderInclude,
      });

      await this.recordAudit(
        tx,
        "purchase-orders.submitted",
        updated,
        user,
        metadata,
      );

      return this.toPurchaseOrderResponse(updated);
    });
  }

  async updatePurchaseOrder(
    id: string,
    dto: UpdatePurchaseOrderDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const purchaseOrder = await this.findPurchaseOrderForUpdate(tx, id);
      this.assertUserCanAccessLocation(user, purchaseOrder.locationId);

      if (purchaseOrder.status !== DocumentStatus.DRAFT) {
        throw new ConflictException(
          "Only draft purchase orders can be updated.",
        );
      }

      const locationId = dto.locationId ?? purchaseOrder.locationId;
      this.assertUserCanAccessLocation(user, locationId);

      await this.validatePurchaseOrderTargets(tx, {
        supplierId: dto.supplierId ?? purchaseOrder.supplierId,
        locationId,
        lines:
          dto.lines ??
          purchaseOrder.lines.map((line) => ({
            itemId: line.itemId,
            qty: line.qty.toNumber(),
            uomId: line.uomId,
            unitCost: line.unitCost.toNumber(),
            costOverrideReason: line.costOverrideReason ?? undefined,
          })),
      });

      if (dto.lines) {
        await tx.purchaseOrderLine.deleteMany({
          where: { purchaseOrderId: id },
        });
      }

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: dto.supplierId,
          locationId: dto.locationId,
          expectedDate: dto.expectedDate
            ? new Date(dto.expectedDate)
            : undefined,
          remarks: dto.remarks,
          lines: dto.lines
            ? {
                create: await Promise.all(
                  dto.lines.map((line) =>
                    this.toPurchaseOrderLineCreateData(
                      tx,
                      dto.supplierId ?? purchaseOrder.supplierId,
                      line,
                      user,
                    ),
                  ),
                ),
              }
            : undefined,
        },
        include: purchaseOrderInclude,
      });

      await this.recordAudit(
        tx,
        "purchase-orders.updated",
        updated,
        user,
        metadata,
      );

      return this.toPurchaseOrderResponse(updated);
    });
  }

  async approvePurchaseOrder(
    id: string,
    dto: ApprovePurchaseOrderDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const purchaseOrder = await this.findPurchaseOrderForUpdate(tx, id);
      this.assertUserCanAccessLocation(user, purchaseOrder.locationId);

      if (purchaseOrder.status !== DocumentStatus.PENDING_APPROVAL) {
        throw new ConflictException(
          "Only purchase orders pending approval can be approved.",
        );
      }

      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: DocumentStatus.APPROVED,
          approvedById: user.id,
          approvedAt: new Date(),
          remarks: dto.remarks ?? purchaseOrder.remarks,
        },
        include: purchaseOrderInclude,
      });

      await tx.purchaseOrderLine.updateMany({
        where: {
          purchaseOrderId: id,
          costOverrideReason: { not: null },
        },
        data: {
          costOverrideApprovedById: user.id,
          costOverrideApprovedAt: new Date(),
        },
      });

      const approved = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id },
        include: purchaseOrderInclude,
      });

      await this.recordAudit(
        tx,
        "purchase-orders.approved",
        approved,
        user,
        metadata,
      );

      return this.toPurchaseOrderResponse(approved);
    });
  }

  async rejectPurchaseOrder(
    id: string,
    dto: RejectPurchaseOrderDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const purchaseOrder = await this.findPurchaseOrderForUpdate(tx, id);
      this.assertUserCanAccessLocation(user, purchaseOrder.locationId);

      if (purchaseOrder.status !== DocumentStatus.PENDING_APPROVAL) {
        throw new ConflictException(
          "Only purchase orders pending approval can be rejected.",
        );
      }

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: DocumentStatus.REJECTED,
          approvedById: user.id,
          approvedAt: new Date(),
          remarks: dto.remarks ?? purchaseOrder.remarks,
        },
        include: purchaseOrderInclude,
      });

      await this.recordAudit(
        tx,
        "purchase-orders.rejected",
        updated,
        user,
        metadata,
      );

      return this.toPurchaseOrderResponse(updated);
    });
  }

  async createReceiving(
    dto: CreateReceivingDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    this.assertUserCanAccessLocation(user, dto.locationId);
    this.validateReceivingDocumentReferences(dto);

    return this.prisma.$transaction(async (tx) => {
      const purchaseOrder = dto.purchaseOrderId
        ? await this.validateReceivingPurchaseOrder(tx, dto)
        : null;

      if (!purchaseOrder) {
        await this.validateReceivingTargets(tx, dto);
      }

      const receiving = await tx.receiving.create({
        data: {
          receivingNumber: await this.nextDocumentNumber(tx, "RR"),
          purchaseOrderId: dto.purchaseOrderId,
          supplierId: dto.supplierId,
          locationId: dto.locationId,
          businessDate: new Date(dto.businessDate),
          drReference: dto.drReference.trim(),
          invoiceReference: dto.invoiceReference.trim(),
          remarks: dto.remarks?.trim(),
          lines: {
            create: dto.lines.map((line) => ({
              itemId: line.itemId,
              acceptedQty: new Prisma.Decimal(line.acceptedQty),
              rejectedQty: new Prisma.Decimal(line.rejectedQty ?? 0),
              remarks: line.remarks,
              unitCost: new Prisma.Decimal(line.unitCost),
            })),
          },
        },
        include: receivingInclude,
      });

      for (const line of receiving.lines) {
        const acceptedQty = new Prisma.Decimal(line.acceptedQty);
        const unitCost = new Prisma.Decimal(line.unitCost);

        if (acceptedQty.lte(0)) {
          continue;
        }

        await tx.ledgerEvent.create({
          data: {
            uuid: randomUUID(),
            locationId: receiving.locationId,
            itemId: line.itemId,
            transactionType: TransactionType.RECEIVE,
            qtyIn: acceptedQty,
            qtyOut: new Prisma.Decimal(0),
            unitCostAtTime: unitCost,
            extendedCost: acceptedQty.mul(unitCost),
            referenceType: ReferenceType.RECEIVING,
            referenceId: receiving.id,
            businessDate: receiving.businessDate,
            createdById: user.id,
            approvedById: user.id,
            metadata: {
              receivingNumber: receiving.receivingNumber,
              purchaseOrderId: receiving.purchaseOrderId,
            },
          },
        });
      }

      if (purchaseOrder) {
        await tx.purchaseOrder.update({
          where: { id: purchaseOrder.id },
          data: {
            status: await this.resolvePurchaseOrderReceivingStatus(
              tx,
              purchaseOrder.id,
            ),
          },
        });
      }

      await this.recordAudit(
        tx,
        "receivings.posted",
        receiving,
        user,
        metadata,
      );

      return this.toReceivingResponse(receiving);
    });
  }

  async closePurchaseOrderBalance(
    id: string,
    dto: ClosePurchaseOrderBalanceDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    const remarks = dto.remarks?.trim();

    if (!remarks) {
      throw new BadRequestException("Close balance reason is required.");
    }

    return this.prisma.$transaction(async (tx) => {
      const purchaseOrder = await this.findPurchaseOrderForUpdate(tx, id);
      this.assertUserCanAccessLocation(user, purchaseOrder.locationId);

      if (purchaseOrder.status !== DocumentStatus.PARTIALLY_RECEIVED) {
        throw new ConflictException(
          "Only partially received purchase orders can be closed.",
        );
      }

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: DocumentStatus.CLOSED,
          remarks: purchaseOrder.remarks
            ? `${purchaseOrder.remarks}\nClose balance: ${remarks}`
            : `Close balance: ${remarks}`,
        },
        include: purchaseOrderInclude,
      });

      await this.recordAudit(
        tx,
        "purchase-orders.balance-closed",
        updated,
        user,
        metadata,
      );

      return this.toPurchaseOrderResponse(updated);
    });
  }

  private async toPurchaseOrderLineCreateData(
    tx: Prisma.TransactionClient,
    supplierId: string,
    line: CreatePurchaseOrderDto["lines"][number],
    user: AuthenticatedUser,
  ) {
    const supplierItem = line.supplierItemId
      ? await tx.supplierItem.findFirst({
          where: {
            active: true,
            id: line.supplierItemId,
            itemId: line.itemId,
            supplierId,
          },
          select: { active: true, id: true, unitCost: true },
        })
      : await tx.supplierItem.findFirst({
          where: { active: true, itemId: line.itemId, supplierId },
          orderBy: [{ supplierSku: "asc" }, { createdAt: "asc" }],
          select: { active: true, id: true, unitCost: true },
        });

    if (line.supplierItemId && !supplierItem) {
      throw new BadRequestException(
        "Supplier item must belong to the selected supplier and item.",
      );
    }

    const defaultUnitCost =
      supplierItem?.active && supplierItem.unitCost
        ? supplierItem.unitCost
        : null;

    if (line.unitCost === undefined && !defaultUnitCost) {
      throw new BadRequestException(
        "Unit cost is required when the supplier item has no default cost.",
      );
    }

    const unitCost =
      line.unitCost === undefined
        ? defaultUnitCost!
        : new Prisma.Decimal(line.unitCost);
    const isOverride = !defaultUnitCost || !unitCost.equals(defaultUnitCost);
    const overrideReason = line.costOverrideReason?.trim();

    if (isOverride && !overrideReason) {
      throw new BadRequestException(
        "Cost override reason is required when PO unit cost differs from supplier default cost.",
      );
    }

    return {
      itemId: line.itemId,
      supplierItemId: supplierItem?.id,
      qty: new Prisma.Decimal(line.qty),
      uomId: line.uomId,
      unitCost,
      defaultUnitCost,
      costOverrideReason: isOverride ? overrideReason : undefined,
      costOverriddenById: isOverride ? user.id : undefined,
      costOverriddenAt: isOverride ? new Date() : undefined,
    };
  }

  private async validatePurchaseOrderTargets(
    tx: Prisma.TransactionClient,
    dto: CreatePurchaseOrderDto,
  ) {
    const [supplier, location, items, uoms] = await Promise.all([
      tx.supplier.findFirst({
        where: { id: dto.supplierId, active: true },
        select: { id: true },
      }),
      tx.location.findFirst({
        where: { id: dto.locationId, active: true },
        select: { id: true },
      }),
      tx.item.findMany({
        where: {
          id: { in: dto.lines.map((line) => line.itemId) },
          active: true,
        },
        select: { id: true },
      }),
      tx.uom.findMany({
        where: {
          id: { in: dto.lines.map((line) => line.uomId) },
          active: true,
        },
        select: { id: true },
      }),
    ]);

    if (!supplier) {
      throw new BadRequestException("Supplier does not exist or is inactive.");
    }

    if (!location) {
      throw new BadRequestException("Location does not exist or is inactive.");
    }

    this.assertAllTargetsFound(
      dto.lines.map((line) => line.itemId),
      items.map((item) => item.id),
      "One or more items do not exist or are inactive.",
    );
    this.assertAllTargetsFound(
      dto.lines.map((line) => line.uomId),
      uoms.map((uom) => uom.id),
      "One or more UOMs do not exist or are inactive.",
    );
  }

  private async validateReceivingTargets(
    tx: Prisma.TransactionClient,
    dto: CreateReceivingDto,
  ) {
    const [supplier, location, items] = await Promise.all([
      tx.supplier.findFirst({
        where: { id: dto.supplierId, active: true },
        select: { id: true },
      }),
      tx.location.findFirst({
        where: { id: dto.locationId, active: true },
        select: { id: true },
      }),
      tx.item.findMany({
        where: {
          id: { in: dto.lines.map((line) => line.itemId) },
          active: true,
        },
        select: { id: true },
      }),
    ]);

    if (!supplier) {
      throw new BadRequestException("Supplier does not exist or is inactive.");
    }

    if (!location) {
      throw new BadRequestException("Location does not exist or is inactive.");
    }

    this.assertAllTargetsFound(
      dto.lines.map((line) => line.itemId),
      items.map((item) => item.id),
      "One or more items do not exist or are inactive.",
    );
  }

  private async validateReceivingPurchaseOrder(
    tx: Prisma.TransactionClient,
    dto: CreateReceivingDto,
  ) {
    const purchaseOrder = await tx.purchaseOrder.findUnique({
      where: { id: dto.purchaseOrderId },
      include: {
        lines: true,
        receivings: {
          include: { lines: true },
          orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
        },
      },
    });

    if (!purchaseOrder) {
      throw new NotFoundException("Purchase order not found.");
    }

    if (
      purchaseOrder.status !== DocumentStatus.APPROVED &&
      purchaseOrder.status !== DocumentStatus.PARTIALLY_RECEIVED
    ) {
      throw new ConflictException(
        "Only approved purchase orders can be received.",
      );
    }

    if (
      purchaseOrder.supplierId !== dto.supplierId ||
      purchaseOrder.locationId !== dto.locationId
    ) {
      throw new BadRequestException(
        "Receiving supplier and location must match the purchase order.",
      );
    }

    const purchaseOrderItemIds = new Set(
      purchaseOrder.lines.map((line) => line.itemId),
    );
    const unexpectedLine = dto.lines.find(
      (line) => !purchaseOrderItemIds.has(line.itemId),
    );

    if (unexpectedLine) {
      throw new BadRequestException(
        "Receiving lines must reference items from the purchase order.",
      );
    }

    const latestReceiving = purchaseOrder.receivings[0];
    const documentReferenceChanged =
      latestReceiving &&
      (this.normalizeDocumentReference(latestReceiving.drReference) !==
        this.normalizeDocumentReference(dto.drReference) ||
        this.normalizeDocumentReference(latestReceiving.invoiceReference) !==
          this.normalizeDocumentReference(dto.invoiceReference));

    if (documentReferenceChanged && !dto.remarks?.trim()) {
      throw new BadRequestException(
        "Reason is required when DR Ref or Invoice differs from the previous receiving for this PO.",
      );
    }

    const receivedByItem = this.receivedByItem(purchaseOrder.receivings);

    for (const line of dto.lines) {
      const purchaseOrderLine = purchaseOrder.lines.find(
        (orderLine) => orderLine.itemId === line.itemId,
      );

      if (!purchaseOrderLine) {
        continue;
      }

      const acceptedQty = new Prisma.Decimal(line.acceptedQty);
      const rejectedQty = new Prisma.Decimal(line.rejectedQty ?? 0);

      if (acceptedQty.add(rejectedQty).lte(0)) {
        throw new BadRequestException(
          "Each receiving line must include accepted or rejected quantity.",
        );
      }

      const receivedQty =
        receivedByItem.get(line.itemId) ?? new Prisma.Decimal(0);
      const remainingQty = Prisma.Decimal.max(
        purchaseOrderLine.qty.sub(receivedQty),
        new Prisma.Decimal(0),
      );

      if (acceptedQty.add(rejectedQty).gt(remainingQty)) {
        throw new BadRequestException(
          "Accepted plus rejected quantity cannot exceed the remaining PO quantity.",
        );
      }
    }

    return purchaseOrder;
  }

  private async resolvePurchaseOrderReceivingStatus(
    tx: Prisma.TransactionClient,
    purchaseOrderId: string,
  ) {
    const purchaseOrder = await tx.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        lines: true,
        receivings: { include: { lines: true } },
      },
    });

    if (!purchaseOrder) {
      throw new NotFoundException("Purchase order not found.");
    }

    const receivedByItem = this.receivedByItem(purchaseOrder.receivings);

    const fullyReceived = purchaseOrder.lines.every((line) => {
      const receivedQty =
        receivedByItem.get(line.itemId) ?? new Prisma.Decimal(0);
      return receivedQty.gte(line.qty);
    });

    return fullyReceived
      ? DocumentStatus.POSTED
      : DocumentStatus.PARTIALLY_RECEIVED;
  }

  private validateReceivingDocumentReferences(dto: CreateReceivingDto) {
    if (!dto.drReference?.trim()) {
      throw new BadRequestException("DR Ref is required.");
    }

    if (!dto.invoiceReference?.trim()) {
      throw new BadRequestException("Invoice is required.");
    }
  }

  private normalizeDocumentReference(value?: string | null) {
    return value?.trim().toLowerCase() ?? "";
  }

  private async findPurchaseOrderForUpdate(
    tx: Prisma.TransactionClient,
    id: string,
  ) {
    const purchaseOrder = await tx.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!purchaseOrder) {
      throw new NotFoundException("Purchase order not found.");
    }

    return purchaseOrder;
  }

  private async nextDocumentNumber(
    tx: Prisma.TransactionClient,
    prefix: "PO" | "RR",
  ) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const count =
      prefix === "PO"
        ? await tx.purchaseOrder.count({
            where: { createdAt: { gte: start, lt: end } },
          })
        : await tx.receiving.count({
            where: { createdAt: { gte: start, lt: end } },
          });

    const datePart = start.toISOString().slice(0, 10).replace(/-/g, "");
    return `${prefix}-${datePart}-${String(count + 1).padStart(4, "0")}`;
  }

  private assertAllTargetsFound(
    expectedIds: string[],
    foundIds: string[],
    message: string,
  ) {
    const found = new Set(foundIds);

    if (expectedIds.some((id) => !found.has(id))) {
      throw new BadRequestException(message);
    }
  }

  private assertUserCanAccessLocation(
    user: AuthenticatedUser,
    locationId: string,
  ) {
    if (!user.locationIds.includes(locationId)) {
      throw new ForbiddenException("Location access denied.");
    }
  }

  private async recordAudit(
    tx: Prisma.TransactionClient,
    action: string,
    entity: { id: string; locationId: string },
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata,
  ) {
    await tx.auditLog.create({
      data: {
        userId: user.id,
        module: "purchasing",
        action,
        entityType: action.startsWith("receivings")
          ? "Receiving"
          : "PurchaseOrder",
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

  private toPurchaseOrderResponse<T>(purchaseOrder: T): T {
    return this.toJson(this.withReceivingTotals(purchaseOrder)) as T;
  }

  private toReceivingResponse<T>(receiving: T): T {
    return this.toJson(receiving) as T;
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

  private withReceivingTotals<T>(purchaseOrder: T): T {
    const value = purchaseOrder as T & {
      lines?: Array<{
        itemId: string;
        qty: Prisma.Decimal;
        receivedQty?: Prisma.Decimal;
        rejectedQty?: Prisma.Decimal;
        remainingQty?: Prisma.Decimal;
      }>;
      receivings?: Array<{
        lines: Array<{
          itemId: string;
          acceptedQty: Prisma.Decimal;
          rejectedQty: Prisma.Decimal;
        }>;
      }>;
    };

    if (!value.lines || !value.receivings) {
      return purchaseOrder;
    }

    const receivedByItem = this.receivedByItem(value.receivings);
    const rejectedByItem = this.rejectedByItem(value.receivings);

    return {
      ...value,
      lines: value.lines.map((line) => {
        const receivedQty =
          receivedByItem.get(line.itemId) ?? new Prisma.Decimal(0);
        const rejectedQty =
          rejectedByItem.get(line.itemId) ?? new Prisma.Decimal(0);
        const remainingQty = Prisma.Decimal.max(
          line.qty.sub(receivedQty),
          new Prisma.Decimal(0),
        );

        return {
          ...line,
          receivedQty,
          rejectedQty,
          remainingQty,
        };
      }),
    };
  }

  private receivedByItem(
    receivings: Array<{
      lines: Array<{ itemId: string; acceptedQty: Prisma.Decimal }>;
    }>,
  ) {
    const receivedByItem = new Map<string, Prisma.Decimal>();

    for (const receiving of receivings) {
      for (const line of receiving.lines) {
        const current =
          receivedByItem.get(line.itemId) ?? new Prisma.Decimal(0);
        receivedByItem.set(line.itemId, current.add(line.acceptedQty));
      }
    }

    return receivedByItem;
  }

  private rejectedByItem(
    receivings: Array<{
      lines: Array<{ itemId: string; rejectedQty: Prisma.Decimal }>;
    }>,
  ) {
    const rejectedByItem = new Map<string, Prisma.Decimal>();

    for (const receiving of receivings) {
      for (const line of receiving.lines) {
        const current =
          rejectedByItem.get(line.itemId) ?? new Prisma.Decimal(0);
        rejectedByItem.set(line.itemId, current.add(line.rejectedQty));
      }
    }

    return rejectedByItem;
  }
}
