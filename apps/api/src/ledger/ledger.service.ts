import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  LedgerEvent,
  DocumentStatus,
  Prisma,
  ReferenceType,
  TransactionType,
  TransferStatus,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { AuthenticatedUser } from "../auth/types";
import { nextBusinessDocumentNumber } from "../common/document-numbering";
import { CostingService, InventoryState } from "../costing/costing.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateAdjustmentRequestDto,
  RejectAdjustmentRequestDto,
} from "./dto/adjustment-request.dto";
import { PostLedgerEventDto } from "./dto/post-ledger-event.dto";
import { ReverseLedgerEventDto } from "./dto/reverse-ledger-event.dto";

interface RequestAuditMetadata {
  ipAddress?: string;
  userAgent?: string;
}

type LedgerEventResponse = Omit<
  LedgerEvent,
  "qtyIn" | "qtyOut" | "unitCostAtTime" | "extendedCost" | "metadata"
> & {
  qtyIn: string;
  qtyOut: string;
  unitCostAtTime: string;
  extendedCost: string;
  metadata: Prisma.JsonValue | null;
};

type StockOnHandEvent = Prisma.LedgerEventGetPayload<{
  include: {
    item: {
      include: {
        baseUom: true;
        category: true;
        looseRemainderUom: true;
        looseWholeUom: true;
      };
    };
    location: true;
  };
}>;

const INBOUND_TRANSACTION_TYPES = new Set<TransactionType>([
  TransactionType.RECEIVE,
  TransactionType.TRANSFER_IN,
]);

const OUTBOUND_TRANSACTION_TYPES = new Set<TransactionType>([
  TransactionType.TRANSFER_OUT,
  TransactionType.WASTAGE,
  TransactionType.ISSUE_TO_OPS,
  TransactionType.SALE_CONSUMPTION,
]);

const EITHER_DIRECTION_TRANSACTION_TYPES = new Set<TransactionType>([
  TransactionType.STOCK_COUNT,
  TransactionType.ADJUSTMENT,
]);

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly costingService: CostingService,
  ) {}

  async list(
    resource: string,
    query: Record<string, string> = {},
    user?: AuthenticatedUser,
  ) {
    if (resource === "inventory.stock-on-hand") {
      const events = await this.prisma.ledgerEvent.findMany({
        where: {
          locationId: this.locationFilter(query.locationId, user),
          itemId: query.itemId,
        },
        include: {
          item: {
            include: {
              baseUom: true,
              category: true,
              looseRemainderUom: true,
              looseWholeUom: true,
            },
          },
          location: true,
        },
        orderBy: [{ businessDate: "asc" }, { createdAt: "asc" }],
      });

      return {
        resource,
        data: await this.toStockOnHandResponse(events, query),
      };
    }

    if (resource === "inventory.movements") {
      const events = await this.prisma.ledgerEvent.findMany({
        where: {
          locationId: this.locationFilter(query.locationId, user),
          itemId: query.itemId,
          transactionType: query.transactionType as TransactionType | undefined,
        },
        orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
        take: this.parseTake(query.take),
      });

      return {
        resource,
        data: events.map((event) => this.toResponse(event)),
      };
    }

    if (resource === "inventory.adjustment-requests") {
      const requests = await this.prisma.adjustmentRequest.findMany({
        where: {
          locationId: this.locationFilter(query.locationId, user),
          status: query.status as DocumentStatus | undefined,
        },
        include: {
          item: { include: { baseUom: true } },
          location: true,
          reasonCode: true,
          requestedBy: true,
          approvedBy: true,
          rejectedBy: true,
        },
        orderBy: [{ createdAt: "desc" }],
        take: this.parseTake(query.take),
      });

      return {
        resource,
        data: requests.map((request) => this.toResponseJson(request)),
      };
    }

    if (resource === "ledger.events.detail") {
      const event = await this.prisma.ledgerEvent.findUnique({
        where: { id: query.id },
      });

      if (!event) {
        throw new NotFoundException("Ledger event not found.");
      }

      if (user) {
        this.assertUserCanAccessLocation(user, event.locationId);
      }

      return this.toResponse(event);
    }

    return {
      resource,
      status: "deferred",
      query,
    };
  }

  async postEvent(
    dto: PostLedgerEventDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.prisma.$transaction((tx) =>
      this.postEventInTransaction(tx, dto, user, metadata),
    );
  }

  async postEventInTransaction(
    tx: Prisma.TransactionClient,
    dto: PostLedgerEventDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    await this.lockLedgerItem(tx, dto.locationId, dto.itemId);

    const existing = await tx.ledgerEvent.findUnique({
      where: { uuid: dto.uuid },
    });

    if (existing) {
      return {
        status: "already_posted",
        idempotent: true,
        event: this.toResponse(existing),
      };
    }

    this.assertUserCanAccessLocation(user, dto.locationId);

    const quantities = this.validateQuantities(
      dto.transactionType,
      dto.qtyIn,
      dto.qtyOut,
    );

    await this.validatePostTargets(
      tx,
      dto.locationId,
      dto.itemId,
      dto.approvedById,
      dto.reasonCodeId,
    );
    await this.validateReference(tx, dto.referenceType, dto.referenceId);

    const currentState = await this.getCurrentState(
      tx,
      dto.locationId,
      dto.itemId,
    );
    this.enforceNegativeStockPolicy(quantities.qtyOut, currentState);

    const unitCostAtTime = await this.resolveUnitCostAtTime(
      tx,
      dto,
      quantities.qtyOut,
      currentState,
    );
    const extendedCost = quantities.movementQty.mul(unitCostAtTime);

    const event = await tx.ledgerEvent.create({
      data: {
        uuid: dto.uuid,
        locationId: dto.locationId,
        itemId: dto.itemId,
        transactionType: dto.transactionType,
        qtyIn: quantities.qtyIn,
        qtyOut: quantities.qtyOut,
        unitCostAtTime,
        extendedCost,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        businessDate: new Date(dto.businessDate),
        createdById: user.id,
        approvedById: dto.approvedById,
        metadata: this.toJsonInput(dto.metadata),
      },
    });

    await this.recordAudit(
      tx,
      "ledger.events.posted",
      event,
      user,
      metadata,
      dto.reasonCodeId,
    );

    return {
      status: "posted",
      idempotent: false,
      event: this.toResponse(event),
    };
  }

  async createAdjustmentRequest(
    dto: CreateAdjustmentRequestDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      this.assertUserCanAccessLocation(user, dto.locationId);

      const quantities = this.validateQuantities(
        TransactionType.ADJUSTMENT,
        dto.qtyIn,
        dto.qtyOut,
      );

      await this.validatePostTargets(
        tx,
        dto.locationId,
        dto.itemId,
        undefined,
        dto.reasonCodeId,
      );
      await this.validateAdjustmentReason(tx, dto.reasonCodeId);

      const currentState = await this.getCurrentState(
        tx,
        dto.locationId,
        dto.itemId,
      );
      this.enforceNegativeStockPolicy(quantities.qtyOut, currentState);

      const unitCostAtTime = quantities.qtyOut.gt(0)
        ? currentState.averageUnitCost
        : new Prisma.Decimal(dto.unitCostAtTime);
      const request = await tx.adjustmentRequest.create({
        data: {
          requestNumber: await this.nextAdjustmentRequestNumber(tx),
          locationId: dto.locationId,
          itemId: dto.itemId,
          qtyIn: quantities.qtyIn,
          qtyOut: quantities.qtyOut,
          unitCostAtTime,
          businessDate: new Date(dto.businessDate),
          reasonCodeId: dto.reasonCodeId,
          remarks: dto.remarks?.trim() || undefined,
          requestedById: user.id,
        },
        include: {
          item: { include: { baseUom: true } },
          location: true,
          reasonCode: true,
          requestedBy: true,
          approvedBy: true,
          rejectedBy: true,
        },
      });

      await this.recordAdjustmentAudit(
        tx,
        "adjustments.requested",
        request,
        user,
        metadata,
      );

      return this.toResponseJson(request);
    });
  }

  async approveAdjustmentRequest(
    id: string,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const request = await tx.adjustmentRequest.findUnique({
        where: { id },
        include: {
          item: { include: { baseUom: true } },
          location: true,
          reasonCode: true,
          requestedBy: true,
          approvedBy: true,
          rejectedBy: true,
        },
      });

      if (!request) {
        throw new NotFoundException("Adjustment request not found.");
      }

      this.assertUserCanAccessLocation(user, request.locationId);

      if (request.status !== DocumentStatus.PENDING_APPROVAL) {
        throw new ConflictException(
          "Only pending adjustment requests can be approved.",
        );
      }

      const posted = await this.postEventInTransaction(
        tx,
        {
          uuid: randomUUID(),
          locationId: request.locationId,
          itemId: request.itemId,
          transactionType: TransactionType.ADJUSTMENT,
          qtyIn:
            request.qtyIn.toNumber() > 0 ? request.qtyIn.toNumber() : undefined,
          qtyOut:
            request.qtyOut.toNumber() > 0
              ? request.qtyOut.toNumber()
              : undefined,
          unitCostAtTime: request.unitCostAtTime.toNumber(),
          referenceType: ReferenceType.ADJUSTMENT,
          referenceId: request.id,
          businessDate: request.businessDate.toISOString(),
          approvedById: user.id,
          reasonCodeId: request.reasonCodeId,
          metadata: {
            adjustmentRequestNumber: request.requestNumber,
            requestedById: request.requestedById,
            remarks: request.remarks,
          },
        },
        user,
        metadata,
      );

      const approved = await tx.adjustmentRequest.update({
        where: { id },
        data: {
          status: DocumentStatus.POSTED,
          approvedById: user.id,
          approvedAt: new Date(),
          ledgerEventId: posted.event.id,
        },
        include: {
          item: { include: { baseUom: true } },
          location: true,
          reasonCode: true,
          requestedBy: true,
          approvedBy: true,
          rejectedBy: true,
        },
      });

      await this.recordAdjustmentAudit(
        tx,
        "adjustments.approved",
        approved,
        user,
        metadata,
      );

      return approved;
    });

    return this.toResponseJson(updated);
  }

  async rejectAdjustmentRequest(
    id: string,
    dto: RejectAdjustmentRequestDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.adjustmentRequest.findUnique({
        where: { id },
        include: {
          item: { include: { baseUom: true } },
          location: true,
          reasonCode: true,
          requestedBy: true,
          approvedBy: true,
          rejectedBy: true,
        },
      });

      if (!request) {
        throw new NotFoundException("Adjustment request not found.");
      }

      this.assertUserCanAccessLocation(user, request.locationId);

      if (request.status !== DocumentStatus.PENDING_APPROVAL) {
        throw new ConflictException(
          "Only pending adjustment requests can be rejected.",
        );
      }

      const rejected = await tx.adjustmentRequest.update({
        where: { id },
        data: {
          status: DocumentStatus.REJECTED,
          rejectedById: user.id,
          rejectedAt: new Date(),
          rejectionReason: dto.reason.trim(),
        },
        include: {
          item: { include: { baseUom: true } },
          location: true,
          reasonCode: true,
          requestedBy: true,
          approvedBy: true,
          rejectedBy: true,
        },
      });

      await this.recordAdjustmentAudit(
        tx,
        "adjustments.rejected",
        rejected,
        user,
        metadata,
      );

      return this.toResponseJson(rejected);
    });
  }

  async reverseEvent(
    id: string,
    dto: ReverseLedgerEventDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.ledgerEvent.findUnique({
        where: { uuid: dto.uuid },
      });

      if (existing) {
        return {
          status: "already_posted",
          idempotent: true,
          event: this.toResponse(existing),
        };
      }

      const original = await tx.ledgerEvent.findUnique({
        where: { id },
        include: { reversals: true },
      });

      if (!original) {
        throw new NotFoundException("Ledger event not found.");
      }

      if (original.reversalOfId) {
        throw new BadRequestException("Reversal events cannot be reversed.");
      }

      if (original.reversals.length > 0) {
        throw new ConflictException("Ledger event has already been reversed.");
      }

      this.assertUserCanAccessLocation(user, original.locationId);

      const referenceType = dto.referenceType ?? original.referenceType;
      const referenceId = dto.referenceId ?? original.referenceId;

      await this.lockLedgerItem(tx, original.locationId, original.itemId);

      await this.validatePostTargets(
        tx,
        original.locationId,
        original.itemId,
        dto.approvedById,
        dto.reasonCodeId,
      );
      await this.validateReference(tx, referenceType, referenceId);

      const qtyOut = original.qtyIn;
      const currentState = await this.getCurrentState(
        tx,
        original.locationId,
        original.itemId,
      );
      this.enforceNegativeStockPolicy(qtyOut, currentState);

      const event = await tx.ledgerEvent.create({
        data: {
          uuid: dto.uuid,
          locationId: original.locationId,
          itemId: original.itemId,
          transactionType: original.transactionType,
          qtyIn: original.qtyOut,
          qtyOut: original.qtyIn,
          unitCostAtTime: original.unitCostAtTime,
          extendedCost: original.extendedCost,
          referenceType,
          referenceId,
          businessDate: new Date(dto.businessDate ?? original.businessDate),
          createdById: user.id,
          approvedById: dto.approvedById,
          reversalOfId: original.id,
          metadata: this.toJsonInput({
            ...(dto.metadata ?? {}),
            reversalReason: dto.reason,
            originalEventId: original.id,
            originalEventUuid: original.uuid,
          }),
        },
      });

      await this.recordAudit(
        tx,
        "ledger.events.reversed",
        event,
        user,
        metadata,
        dto.reasonCodeId,
        {
          originalEventId: original.id,
          originalEventUuid: original.uuid,
        },
      );

      return {
        status: "posted",
        idempotent: false,
        event: this.toResponse(event),
      };
    });
  }

  private async getCurrentState(
    tx: Prisma.TransactionClient,
    locationId: string,
    itemId: string,
  ) {
    const events = await tx.ledgerEvent.findMany({
      where: { locationId, itemId },
      orderBy: [{ businessDate: "asc" }, { createdAt: "asc" }],
    });

    return this.costingService.calculateState(events);
  }

  private async lockLedgerItem(
    tx: Prisma.TransactionClient,
    locationId: string,
    itemId: string,
  ) {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${`${locationId}:${itemId}`}, 0))
    `;
  }

  private async resolveUnitCostAtTime(
    tx: Prisma.TransactionClient,
    dto: PostLedgerEventDto,
    qtyOut: Prisma.Decimal,
    currentState: InventoryState,
  ) {
    if (dto.transactionType === TransactionType.TRANSFER_IN) {
      const dispatchedEvent = await tx.ledgerEvent.findFirst({
        where: {
          itemId: dto.itemId,
          referenceType: ReferenceType.TRANSFER,
          referenceId: dto.referenceId,
          transactionType: TransactionType.TRANSFER_OUT,
          qtyOut: { gt: 0 },
        },
        orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
      });

      if (!dispatchedEvent) {
        throw new BadRequestException(
          "TRANSFER_IN requires a dispatched TRANSFER_OUT event for the same transfer and item.",
        );
      }

      return dispatchedEvent.unitCostAtTime;
    }

    if (
      qtyOut.gt(0) &&
      this.costingService.shouldUseCurrentAverageCost(dto.transactionType)
    ) {
      return currentState.averageUnitCost;
    }

    const postedUnitCost = new Prisma.Decimal(dto.unitCostAtTime);

    if (
      postedUnitCost.lte(0) &&
      currentState.averageUnitCost.gt(0) &&
      this.costingService.shouldUseCurrentAverageCost(dto.transactionType)
    ) {
      return currentState.averageUnitCost;
    }

    return postedUnitCost;
  }

  private enforceNegativeStockPolicy(
    qtyOut: Prisma.Decimal,
    currentState: InventoryState,
  ) {
    if (qtyOut.gt(0) && currentState.qtyOnHand.sub(qtyOut).lt(0)) {
      throw new ConflictException(
        "Posting this ledger event would create negative stock.",
      );
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

  private locationFilter(locationId?: string, user?: AuthenticatedUser) {
    if (locationId) {
      if (user) {
        this.assertUserCanAccessLocation(user, locationId);
      }
      return locationId;
    }

    return user ? { in: user.locationIds } : undefined;
  }

  private validateQuantities(
    transactionType: TransactionType,
    rawQtyIn = 0,
    rawQtyOut = 0,
  ) {
    const qtyIn = new Prisma.Decimal(rawQtyIn);
    const qtyOut = new Prisma.Decimal(rawQtyOut);
    const hasQtyIn = qtyIn.gt(0);
    const hasQtyOut = qtyOut.gt(0);

    if (hasQtyIn === hasQtyOut) {
      throw new BadRequestException(
        "Exactly one of qtyIn or qtyOut must be greater than zero.",
      );
    }

    if (INBOUND_TRANSACTION_TYPES.has(transactionType) && !hasQtyIn) {
      throw new BadRequestException(
        `${transactionType} requires qtyIn and does not allow qtyOut.`,
      );
    }

    if (OUTBOUND_TRANSACTION_TYPES.has(transactionType) && !hasQtyOut) {
      throw new BadRequestException(
        `${transactionType} requires qtyOut and does not allow qtyIn.`,
      );
    }

    if (
      !INBOUND_TRANSACTION_TYPES.has(transactionType) &&
      !OUTBOUND_TRANSACTION_TYPES.has(transactionType) &&
      !EITHER_DIRECTION_TRANSACTION_TYPES.has(transactionType)
    ) {
      throw new BadRequestException(
        `Unsupported ledger transaction type: ${transactionType}.`,
      );
    }

    return {
      qtyIn,
      qtyOut,
      movementQty: hasQtyIn ? qtyIn : qtyOut,
    };
  }

  private async validatePostTargets(
    tx: Prisma.TransactionClient,
    locationId: string,
    itemId: string,
    approvedById?: string,
    reasonCodeId?: string,
  ) {
    const [location, item, approver, reasonCode] = await Promise.all([
      tx.location.findFirst({
        where: { id: locationId, active: true },
        select: { id: true },
      }),
      tx.item.findFirst({
        where: { id: itemId, active: true },
        select: { id: true },
      }),
      approvedById
        ? tx.user.findFirst({
            where: { id: approvedById, active: true },
            select: { id: true },
          })
        : null,
      reasonCodeId
        ? tx.reasonCode.findFirst({
            where: { id: reasonCodeId, active: true },
            select: { id: true },
          })
        : null,
    ]);

    if (!location) {
      throw new BadRequestException("Location does not exist or is inactive.");
    }

    if (!item) {
      throw new BadRequestException("Item does not exist or is inactive.");
    }

    if (approvedById && !approver) {
      throw new BadRequestException("Approver does not exist or is inactive.");
    }

    if (reasonCodeId && !reasonCode) {
      throw new BadRequestException(
        "Reason code does not exist or is inactive.",
      );
    }
  }

  private async validateReference(
    tx: Prisma.TransactionClient,
    referenceType: ReferenceType,
    referenceId: string,
  ) {
    const found = await this.findReference(tx, referenceType, referenceId);

    if (!found) {
      throw new BadRequestException(
        `${referenceType} reference does not exist.`,
      );
    }
  }

  private findReference(
    tx: Prisma.TransactionClient,
    referenceType: ReferenceType,
    referenceId: string,
  ) {
    switch (referenceType) {
      case ReferenceType.PO:
        return tx.purchaseOrder.findUnique({
          where: { id: referenceId },
          select: { id: true },
        });
      case ReferenceType.RECEIVING:
        return tx.receiving.findUnique({
          where: { id: referenceId },
          select: { id: true },
        });
      case ReferenceType.TRANSFER:
        return tx.transfer.findUnique({
          where: { id: referenceId },
          select: { id: true },
        });
      case ReferenceType.WASTAGE:
        return tx.wastage.findUnique({
          where: { id: referenceId },
          select: { id: true },
        });
      case ReferenceType.COUNT:
        return tx.stockCount.findUnique({
          where: { id: referenceId },
          select: { id: true },
        });
      case ReferenceType.ISSUE:
        return tx.issueToOps.findUnique({
          where: { id: referenceId },
          select: { id: true },
        });
      case ReferenceType.SALES_BATCH:
        return tx.salesBatch.findUnique({
          where: { id: referenceId },
          select: { id: true },
        });
      case ReferenceType.EMERGENCY_PURCHASE:
        return tx.emergencyPurchase.findUnique({
          where: { id: referenceId },
          select: { id: true },
        });
      case ReferenceType.SYNC_BATCH:
        return tx.syncBatch.findUnique({
          where: { id: referenceId },
          select: { id: true },
        });
      case ReferenceType.ADJUSTMENT:
        return tx.adjustmentRequest.findUnique({
          where: { id: referenceId },
          select: { id: true },
        });
      default:
        return Promise.resolve(null);
    }
  }

  private async validateAdjustmentReason(
    tx: Prisma.TransactionClient,
    reasonCodeId: string,
  ) {
    const reasonCode = await tx.reasonCode.findFirst({
      where: { id: reasonCodeId, active: true, type: "ADJUSTMENT" },
      select: { id: true },
    });

    if (!reasonCode) {
      throw new BadRequestException("Select an active adjustment reason.");
    }
  }

  private async nextAdjustmentRequestNumber(tx: Prisma.TransactionClient) {
    return nextBusinessDocumentNumber(tx, "ADJ");
  }

  private async recordAudit(
    tx: Prisma.TransactionClient,
    action: string,
    event: LedgerEvent,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata,
    reasonCodeId?: string,
    extraAfter: Record<string, string> = {},
  ) {
    await tx.auditLog.create({
      data: {
        userId: user.id,
        module: "ledger",
        action,
        entityType: "LedgerEvent",
        entityId: event.id,
        locationId: event.locationId,
        reasonCodeId,
        after: {
          ...this.toAuditJson(event),
          ...extraAfter,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });
  }

  private async recordAdjustmentAudit(
    tx: Prisma.TransactionClient,
    action: string,
    request: { id: string; locationId: string; reasonCodeId: string },
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata,
  ) {
    await tx.auditLog.create({
      data: {
        userId: user.id,
        module: "inventory.adjustments",
        action,
        entityType: "AdjustmentRequest",
        entityId: request.id,
        locationId: request.locationId,
        reasonCodeId: request.reasonCodeId,
        after: this.toResponseJson(request) as Prisma.InputJsonValue,
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

  private async toStockOnHandResponse(
    events: StockOnHandEvent[],
    query: Record<string, string>,
  ) {
    const groupedEvents = new Map<string, StockOnHandEvent[]>();

    for (const event of events) {
      const key = `${event.locationId}:${event.itemId}`;
      const itemEvents = groupedEvents.get(key) ?? [];
      itemEvents.push(event);
      groupedEvents.set(key, itemEvents);
    }

    const rowMap = new Map<string, ReturnType<typeof this.stockRow>>();

    for (const itemEvents of groupedEvents.values()) {
      const firstEvent = itemEvents[0];
      const lastEvent = itemEvents[itemEvents.length - 1];
      const state = this.costingService.calculateState(itemEvents);

      rowMap.set(
        `${firstEvent.locationId}:${firstEvent.itemId}`,
        this.stockRow({
          averageUnitCost: state.averageUnitCost,
          inventoryValue: state.inventoryValue,
          item: firstEvent.item,
          lastBusinessDate: lastEvent.businessDate,
          lastMovementAt: lastEvent.createdAt,
          location: firstEvent.location,
          qtyOnHand: state.qtyOnHand,
        }),
      );
    }

    await this.applyTransferReservations(rowMap, query);

    return [...rowMap.values()].sort((left, right) => {
      const locationDiff = left.locationCode.localeCompare(right.locationCode);

      if (locationDiff !== 0) {
        return locationDiff;
      }

      return left.sku.localeCompare(right.sku);
    });
  }

  private stockRow({
    averageUnitCost,
    inventoryValue,
    item,
    lastBusinessDate,
    lastMovementAt,
    location,
    qtyOnHand,
  }: {
    averageUnitCost: Prisma.Decimal;
    inventoryValue: Prisma.Decimal;
    item: StockOnHandEvent["item"];
    lastBusinessDate: Date;
    lastMovementAt: Date;
    location: StockOnHandEvent["location"];
    qtyOnHand: Prisma.Decimal;
  }) {
    return {
      locationId: location.id,
      locationCode: location.code,
      locationName: location.name,
      itemId: item.id,
      sku: item.sku,
      itemName: item.name,
      itemType: item.itemType,
      categoryId: item.categoryId,
      categoryName: item.category?.name ?? null,
      baseUomCode: item.baseUom.code,
      displayQty: this.formatStockQty(item, qtyOnHand),
      displayAvailableQty: this.formatStockQty(item, qtyOnHand),
      looseCountEnabled: item.looseCountEnabled,
      looseRemainderUomCode: item.looseRemainderUom?.code ?? null,
      looseWholeUnitQty: item.looseWholeUnitQty?.toString() ?? null,
      looseWholeUomCode: item.looseWholeUom?.code ?? null,
      qtyOnHand: this.formatDecimal(qtyOnHand),
      reservedOutQty: this.formatDecimal(new Prisma.Decimal(0)),
      inTransitInQty: this.formatDecimal(new Prisma.Decimal(0)),
      availableQty: this.formatDecimal(qtyOnHand),
      averageUnitCost: this.formatDecimal(averageUnitCost),
      inventoryValue: this.formatDecimal(inventoryValue),
      lowStockThreshold: item.lowStockThreshold?.toString() ?? null,
      stockStatus: this.stockStatus(item.lowStockThreshold ?? null, qtyOnHand),
      belowLowStock:
        item.lowStockThreshold !== null &&
        qtyOnHand.gt(0) &&
        qtyOnHand.lte(item.lowStockThreshold),
      lastBusinessDate: lastBusinessDate.toISOString(),
      lastMovementAt: lastMovementAt.toISOString(),
    };
  }

  private async applyTransferReservations(
    rowMap: Map<string, ReturnType<typeof this.stockRow>>,
    query: Record<string, string>,
  ) {
    const transferLines = await this.prisma.transferLine.findMany({
      where: {
        itemId: query.itemId,
        transfer: {
          status: {
            in: [TransferStatus.DISPATCHED, TransferStatus.VARIANCE_REVIEW],
          },
        },
      },
      include: {
        item: {
          include: {
            baseUom: true,
            category: true,
            looseRemainderUom: true,
            looseWholeUom: true,
          },
        },
        transfer: {
          include: {
            sourceLocation: true,
            targetLocation: true,
          },
        },
      },
    });

    for (const line of transferLines) {
      const pickedQty = line.pickedQty ?? new Prisma.Decimal(0);
      const receivedQty = line.receivedQty ?? new Prisma.Decimal(0);
      const unresolvedQty = pickedQty.sub(receivedQty);

      if (unresolvedQty.lte(0)) {
        continue;
      }

      if (
        !query.locationId ||
        line.transfer.sourceLocationId === query.locationId
      ) {
        this.addTransferQty(rowMap, {
          item: line.item,
          location: line.transfer.sourceLocation,
          qty: unresolvedQty,
          type: "reservedOutQty",
        });
      }

      if (
        !query.locationId ||
        line.transfer.targetLocationId === query.locationId
      ) {
        this.addTransferQty(rowMap, {
          item: line.item,
          location: line.transfer.targetLocation,
          qty: unresolvedQty,
          type: "inTransitInQty",
        });
      }
    }
  }

  private addTransferQty(
    rowMap: Map<string, ReturnType<typeof this.stockRow>>,
    {
      item,
      location,
      qty,
      type,
    }: {
      item: StockOnHandEvent["item"];
      location: StockOnHandEvent["location"];
      qty: Prisma.Decimal;
      type: "reservedOutQty" | "inTransitInQty";
    },
  ) {
    const key = `${location.id}:${item.id}`;
    const existing =
      rowMap.get(key) ??
      this.stockRow({
        averageUnitCost: new Prisma.Decimal(0),
        inventoryValue: new Prisma.Decimal(0),
        item,
        lastBusinessDate: new Date(),
        lastMovementAt: new Date(),
        location,
        qtyOnHand: new Prisma.Decimal(0),
      });
    const nextQty = new Prisma.Decimal(existing[type]).add(qty);
    const reservedOutQty =
      type === "reservedOutQty"
        ? nextQty
        : new Prisma.Decimal(existing.reservedOutQty);
    const qtyOnHand = new Prisma.Decimal(existing.qtyOnHand);
    const availableQty = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      qtyOnHand.sub(reservedOutQty),
    );

    existing[type] = this.formatDecimal(nextQty);
    existing.availableQty = this.formatDecimal(availableQty);
    existing.displayAvailableQty = this.formatStockQty(item, availableQty);
    existing.stockStatus = this.stockStatus(
      item.lowStockThreshold ?? null,
      availableQty,
    );
    existing.belowLowStock =
      item.lowStockThreshold !== null &&
      availableQty.gt(0) &&
      availableQty.lte(item.lowStockThreshold);

    rowMap.set(key, existing);
  }

  private stockStatus(
    lowStockThreshold: Prisma.Decimal | null,
    qtyOnHand: Prisma.Decimal,
  ) {
    if (qtyOnHand.lte(0)) {
      return "OUT_OF_STOCK";
    }

    if (lowStockThreshold !== null && qtyOnHand.lte(lowStockThreshold)) {
      return "LOW";
    }

    return "OK";
  }

  private formatStockQty(
    item: StockOnHandEvent["item"],
    qtyOnHand: Prisma.Decimal,
  ) {
    if (
      !item.looseCountEnabled ||
      !item.looseWholeUnitQty ||
      !item.looseWholeUom ||
      !item.looseRemainderUom
    ) {
      return `${this.formatDecimal(qtyOnHand)} ${item.baseUom.code}`;
    }

    const wholeUnitQty = item.looseWholeUnitQty;

    if (wholeUnitQty.lte(0)) {
      return `${this.formatDecimal(qtyOnHand)} ${item.baseUom.code}`;
    }

    const wholeUnits = qtyOnHand.div(wholeUnitQty).floor();
    const baseRemainder = qtyOnHand.sub(wholeUnits.mul(wholeUnitQty));
    const looseRemainder = this.convertBaseRemainderToLoose(
      baseRemainder,
      item.baseUom.code,
      item.looseRemainderUom.code,
    );

    return `${wholeUnits.toString()} ${item.looseWholeUom.code} + ${this.formatDecimal(looseRemainder)} ${item.looseRemainderUom.code}`;
  }

  private convertBaseRemainderToLoose(
    qty: Prisma.Decimal,
    baseUomCode: string,
    looseUomCode: string,
  ) {
    if (baseUomCode === looseUomCode) {
      return qty;
    }

    const factorByPair: Record<string, string> = {
      "KG:G": "1000",
      "L:ML": "1000",
    };
    const factor = factorByPair[`${baseUomCode}:${looseUomCode}`];

    return factor ? qty.mul(factor) : qty;
  }

  private formatDecimal(value: Prisma.Decimal) {
    return value.toDecimalPlaces(6).toString();
  }

  private toJsonInput(
    value: Record<string, unknown> | undefined,
  ): Prisma.InputJsonValue | undefined {
    if (!value) {
      return undefined;
    }

    return value as Prisma.InputJsonValue;
  }

  private toAuditJson(event: LedgerEvent): Record<string, string | null> {
    return {
      id: event.id,
      uuid: event.uuid,
      locationId: event.locationId,
      itemId: event.itemId,
      transactionType: event.transactionType,
      qtyIn: event.qtyIn.toString(),
      qtyOut: event.qtyOut.toString(),
      unitCostAtTime: event.unitCostAtTime.toString(),
      extendedCost: event.extendedCost.toString(),
      referenceType: event.referenceType,
      referenceId: event.referenceId,
      businessDate: event.businessDate.toISOString(),
      createdById: event.createdById,
      approvedById: event.approvedById,
      reversalOfId: event.reversalOfId,
    };
  }

  private toResponse(event: LedgerEvent): LedgerEventResponse {
    return {
      ...event,
      qtyIn: event.qtyIn.toString(),
      qtyOut: event.qtyOut.toString(),
      unitCostAtTime: event.unitCostAtTime.toString(),
      extendedCost: event.extendedCost.toString(),
    };
  }

  private toResponseJson<T>(value: T): T {
    return JSON.parse(
      JSON.stringify(value, (_key, nestedValue) =>
        nestedValue instanceof Prisma.Decimal
          ? nestedValue.toString()
          : nestedValue,
      ),
    ) as T;
  }
}
