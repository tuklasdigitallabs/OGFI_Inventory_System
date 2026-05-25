import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  ReferenceType,
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
  ApproveTransferDto,
  CreateTransferDto,
  DispatchTransferDto,
  ReceiveTransferDto,
  ResolveTransferVarianceDto,
} from "./dto/transfers.dto";

interface RequestAuditMetadata {
  ipAddress?: string;
  userAgent?: string;
}

const transferInclude = {
  sourceLocation: true,
  targetLocation: true,
  lines: {
    include: {
      item: { include: { baseUom: true } },
    },
    orderBy: { item: { sku: "asc" } },
  },
} satisfies Prisma.TransferInclude;

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly costingService: CostingService,
  ) {}

  async list(query: Record<string, string> = {}, user: AuthenticatedUser) {
    if (query.sourceLocationId) {
      this.assertUserCanAccessLocation(user, query.sourceLocationId);
    }
    if (query.targetLocationId) {
      this.assertUserCanAccessLocation(user, query.targetLocationId);
    }

    const transfers = await this.prisma.transfer.findMany({
      where: {
        sourceLocationId: query.sourceLocationId,
        targetLocationId: query.targetLocationId,
        OR:
          query.sourceLocationId || query.targetLocationId
            ? undefined
            : [
                { sourceLocationId: { in: user.locationIds } },
                { targetLocationId: { in: user.locationIds } },
              ],
        status: query.status as TransferStatus | undefined,
      },
      include: transferInclude,
      orderBy: [{ createdAt: "desc" }],
      take: this.parseTake(query.take),
    });

    return {
      resource: "transfers.list",
      data: transfers.map((transfer) => ({
        ...this.toResponse(transfer),
        lineCount: transfer.lines.length,
      })),
    };
  }

  async getTransfer(id: string, user: AuthenticatedUser) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: transferInclude,
    });

    if (!transfer) {
      throw new NotFoundException("Transfer not found.");
    }

    this.assertUserCanAccessLocation(user, transfer.sourceLocationId);
    this.assertUserCanAccessLocation(user, transfer.targetLocationId);

    return this.toResponse(transfer);
  }

  async getVariance(id: string, user: AuthenticatedUser) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: transferInclude,
    });

    if (!transfer) {
      throw new NotFoundException("Transfer not found.");
    }

    this.assertUserCanAccessLocation(user, transfer.sourceLocationId);
    this.assertUserCanAccessLocation(user, transfer.targetLocationId);

    return {
      transfer: this.toResponse(transfer),
      lines: transfer.lines.map((line) => {
        const pickedQty = line.pickedQty ?? new Prisma.Decimal(0);
        const receivedQty = line.receivedQty ?? new Prisma.Decimal(0);

        return this.toJson({
          id: line.id,
          item: line.item,
          pickedQty,
          receivedQty,
          varianceQty: receivedQty.sub(pickedQty),
        });
      }),
    };
  }

  async createTransfer(
    dto: CreateTransferDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    this.assertUserCanAccessLocation(user, dto.sourceLocationId);
    this.assertUserCanAccessLocation(user, dto.targetLocationId);

    if (dto.sourceLocationId === dto.targetLocationId) {
      throw new BadRequestException(
        "Source and target locations must be different.",
      );
    }
    this.assertUniqueItems(dto.lines);

    return this.prisma.$transaction(async (tx) => {
      await this.validateTransferTargets(tx, dto);
      const sourceStock = await this.sourceStockSnapshots(dto);
      const lowStockLines = sourceStock.filter(
        (line) => line.lowStockAfterRequest,
      );

      const transfer = await tx.transfer.create({
        data: {
          transferNumber: await this.nextTransferNumber(tx),
          sourceLocationId: dto.sourceLocationId,
          targetLocationId: dto.targetLocationId,
          neededDate: dto.neededDate ? new Date(dto.neededDate) : null,
          requiresLowStockApproval: lowStockLines.length > 0,
          lowStockApprovalReason:
            lowStockLines.length > 0
              ? "One or more transfer lines will bring source stock to or below low stock threshold."
              : null,
          remarks: dto.remarks?.trim(),
          lines: {
            create: sourceStock.map((line) => ({
              itemId: line.itemId,
              requestedQty: new Prisma.Decimal(line.qty),
              sourceQtyAvailableAtRequest: line.availableQty,
              sourceQtyRemainingAfterRequest: line.remainingQty,
              sourceLowStockThreshold: line.lowStockThreshold,
              sourceLowStockAfterRequest: line.lowStockAfterRequest,
            })),
          },
        },
        include: transferInclude,
      });

      await this.recordAudit(tx, "transfers.created", transfer, user, metadata);

      return this.toResponse(transfer);
    });
  }

  async approveTransfer(
    id: string,
    dto: ApproveTransferDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await this.findTransferForUpdate(tx, id);
      this.assertUserCanAccessLocation(user, transfer.sourceLocationId);
      this.assertUserCanAccessLocation(user, transfer.targetLocationId);

      if (transfer.status !== TransferStatus.DRAFT) {
        throw new ConflictException("Only draft transfers can be approved.");
      }

      const updated = await tx.transfer.update({
        where: { id },
        data: {
          status: TransferStatus.APPROVED,
          remarks: dto.remarks?.trim() || transfer.remarks,
        },
        include: transferInclude,
      });

      await this.recordAudit(tx, "transfers.approved", updated, user, metadata);

      return this.toResponse(updated);
    });
  }

  async dispatchTransfer(
    id: string,
    dto: DispatchTransferDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    const transfer = await this.getTransferForAction(id);
    this.assertUserCanAccessLocation(user, transfer.sourceLocationId);

    if (transfer.status !== TransferStatus.APPROVED) {
      throw new ConflictException("Only approved transfers can be dispatched.");
    }

    const pickedByLineId = this.linesById(dto.lines, "pickedQty");
    this.validateDispatchLines(transfer, pickedByLineId);
    await this.validateSourceStock(transfer, pickedByLineId);

    return this.prisma.$transaction(async (tx) => {
      for (const line of transfer.lines) {
        const pickedQty = pickedByLineId.get(line.id) ?? 0;
        const unitCost =
          pickedQty > 0
            ? await this.currentAverageUnitCost(
                transfer.sourceLocationId,
                line.itemId,
              )
            : new Prisma.Decimal(0);

        await tx.transferLine.update({
          where: { id: line.id },
          data: {
            pickedQty: new Prisma.Decimal(pickedQty),
            unitCost,
          },
        });
      }

      const updated = await tx.transfer.update({
        where: { id },
        data: {
          status: TransferStatus.DISPATCHED,
          remarks: dto.remarks?.trim() || transfer.remarks,
        },
        include: transferInclude,
      });

      await this.recordAudit(
        tx,
        "transfers.dispatched",
        updated,
        user,
        metadata,
      );

      return this.toResponse(updated);
    });
  }

  async receiveTransfer(
    id: string,
    dto: ReceiveTransferDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    const transfer = await this.getTransferForAction(id);
    this.assertUserCanAccessLocation(user, transfer.targetLocationId);

    if (transfer.status !== TransferStatus.DISPATCHED) {
      throw new ConflictException("Only dispatched transfers can be received.");
    }

    const receivedByLineId = this.linesById(dto.lines, "receivedQty");
    this.validateReceiveLines(transfer, receivedByLineId);
    const hasVariance = transfer.lines.some((line) => {
      const pickedQty = Number(line.pickedQty ?? 0);
      const receivedQty = receivedByLineId.get(line.id) ?? 0;
      return receivedQty !== pickedQty;
    });

    return this.prisma.$transaction(async (tx) => {
      const postedCosts = new Map<string, string>();

      for (const line of transfer.lines) {
        const receivedQty = receivedByLineId.get(line.id) ?? 0;

        if (receivedQty <= 0) {
          continue;
        }

        const outbound = await this.postConfirmedTransferMovement(
          tx,
          transfer,
          line,
          new Prisma.Decimal(receivedQty),
          user,
          metadata,
          "confirmed_transfer",
        );
        postedCosts.set(line.id, outbound.event.unitCostAtTime);
      }

      for (const line of transfer.lines) {
        await tx.transferLine.update({
          where: { id: line.id },
          data: {
            receivedQty: new Prisma.Decimal(receivedByLineId.get(line.id) ?? 0),
            unitCost: postedCosts.has(line.id)
              ? new Prisma.Decimal(postedCosts.get(line.id)!)
              : line.unitCost,
          },
        });
      }

      const updated = await tx.transfer.update({
        where: { id },
        data: {
          status: hasVariance
            ? TransferStatus.VARIANCE_REVIEW
            : TransferStatus.RECEIVED,
          varianceNotes: hasVariance ? dto.varianceNotes?.trim() : null,
        },
        include: transferInclude,
      });

      await this.recordAudit(
        tx,
        hasVariance ? "transfers.variance-captured" : "transfers.received",
        updated,
        user,
        metadata,
      );

      return this.toResponse(updated);
    });
  }

  async resolveVariance(
    id: string,
    dto: ResolveTransferVarianceDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    const transfer = await this.getTransferForAction(id);
    this.assertUserCanAccessLocation(user, transfer.sourceLocationId);
    this.assertUserCanAccessLocation(user, transfer.targetLocationId);

    if (transfer.status !== TransferStatus.VARIANCE_REVIEW) {
      throw new ConflictException(
        "Only transfers in variance review can be resolved.",
      );
    }

    const remainingByLineId = new Map<string, Prisma.Decimal>();

    for (const line of transfer.lines) {
      const pickedQty = line.pickedQty ?? new Prisma.Decimal(0);
      const receivedQty = line.receivedQty ?? new Prisma.Decimal(0);
      const remainingQty = pickedQty.sub(receivedQty);

      if (remainingQty.gt(0)) {
        remainingByLineId.set(line.id, remainingQty);
      }
    }

    if (remainingByLineId.size === 0) {
      throw new ConflictException("Transfer has no unresolved variance.");
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.resolution === "RECEIVE_BALANCE") {
        for (const line of transfer.lines) {
          const remainingQty = remainingByLineId.get(line.id);

          if (!remainingQty) {
            continue;
          }

          await this.postConfirmedTransferMovement(
            tx,
            transfer,
            line,
            remainingQty,
            user,
            metadata,
            "variance_balance_received",
          );
        }
      }

      if (dto.resolution === "LOSS_AT_SOURCE") {
        for (const line of transfer.lines) {
          const remainingQty = remainingByLineId.get(line.id);

          if (!remainingQty) {
            continue;
          }

          await this.ledgerService.postEventInTransaction(
            tx,
            {
              uuid: randomUUID(),
              locationId: transfer.sourceLocationId,
              itemId: line.itemId,
              transactionType: TransactionType.ADJUSTMENT,
              qtyOut: remainingQty.toNumber(),
              unitCostAtTime: Number(line.unitCost ?? 0),
              referenceType: ReferenceType.TRANSFER,
              referenceId: transfer.id,
              businessDate: new Date().toISOString(),
              approvedById: user.id,
              metadata: {
                transferNumber: transfer.transferNumber,
                resolution: dto.resolution,
              },
            },
            user,
            metadata,
          );
        }
      }

      if (dto.resolution === "RECEIVE_BALANCE") {
        for (const line of transfer.lines) {
          if (!remainingByLineId.has(line.id)) {
            continue;
          }

          await tx.transferLine.update({
            where: { id: line.id },
            data: { receivedQty: line.pickedQty },
          });
        }
      }

      const updated = await tx.transfer.update({
        where: { id },
        data: {
          status:
            dto.resolution === "RECEIVE_BALANCE"
              ? TransferStatus.RECEIVED
              : TransferStatus.CLOSED,
          varianceNotes: [transfer.varianceNotes, dto.notes]
            .filter(Boolean)
            .join(" | "),
        },
        include: transferInclude,
      });

      await this.recordAudit(
        tx,
        "transfers.variance-resolved",
        updated,
        user,
        metadata,
      );

      return this.toResponse(updated);
    });
  }

  private async validateTransferTargets(
    tx: Prisma.TransactionClient,
    dto: CreateTransferDto,
  ) {
    const [sourceLocation, targetLocation, items] = await Promise.all([
      tx.location.findFirst({
        where: { id: dto.sourceLocationId, active: true },
        select: { id: true },
      }),
      tx.location.findFirst({
        where: { id: dto.targetLocationId, active: true },
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

    if (!sourceLocation) {
      throw new BadRequestException(
        "Source location does not exist or is inactive.",
      );
    }

    if (!targetLocation) {
      throw new BadRequestException(
        "Target location does not exist or is inactive.",
      );
    }

    const foundItemIds = new Set(items.map((item) => item.id));

    if (dto.lines.some((line) => !foundItemIds.has(line.itemId))) {
      throw new BadRequestException(
        "One or more items do not exist or are inactive.",
      );
    }
  }

  private validateDispatchLines(
    transfer: Prisma.TransferGetPayload<{ include: typeof transferInclude }>,
    pickedByLineId: Map<string, number>,
  ) {
    let hasPickedQty = false;

    for (const line of transfer.lines) {
      const pickedQty = pickedByLineId.get(line.id);

      if (pickedQty === undefined) {
        throw new BadRequestException("Dispatch quantity is missing.");
      }

      if (pickedQty > Number(line.requestedQty)) {
        throw new BadRequestException(
          "Picked quantity cannot exceed requested quantity.",
        );
      }

      if (pickedQty > 0) {
        hasPickedQty = true;
      }
    }

    if (!hasPickedQty) {
      throw new BadRequestException(
        "At least one picked quantity is required to dispatch.",
      );
    }
  }

  private validateReceiveLines(
    transfer: Prisma.TransferGetPayload<{ include: typeof transferInclude }>,
    receivedByLineId: Map<string, number>,
  ) {
    let hasReceivedQty = false;

    for (const line of transfer.lines) {
      const receivedQty = receivedByLineId.get(line.id);
      const pickedQty = Number(line.pickedQty ?? 0);

      if (receivedQty === undefined) {
        throw new BadRequestException("Received quantity is missing.");
      }

      if (receivedQty > pickedQty) {
        throw new BadRequestException(
          "Received quantity cannot exceed picked quantity.",
        );
      }

      if (receivedQty > 0) {
        hasReceivedQty = true;
      }
    }

    if (!hasReceivedQty) {
      throw new BadRequestException(
        "At least one received quantity is required.",
      );
    }
  }

  private async validateSourceStock(
    transfer: Prisma.TransferGetPayload<{ include: typeof transferInclude }>,
    pickedByLineId: Map<string, number>,
  ) {
    for (const line of transfer.lines) {
      const pickedQty = pickedByLineId.get(line.id) ?? 0;

      if (pickedQty <= 0) {
        continue;
      }

      const events = await this.prisma.ledgerEvent.findMany({
        where: {
          locationId: transfer.sourceLocationId,
          itemId: line.itemId,
        },
        orderBy: [{ businessDate: "asc" }, { createdAt: "asc" }],
      });
      const state = this.costingService.calculateState(events);
      const reservedQty = await this.reservedOutQty(
        transfer.sourceLocationId,
        line.itemId,
      );
      const availableQty = state.qtyOnHand.sub(reservedQty);

      if (availableQty.lt(pickedQty)) {
        throw new ConflictException(
          `Insufficient stock to dispatch ${line.item.sku}.`,
        );
      }
    }
  }

  private async sourceStockSnapshots(dto: CreateTransferDto) {
    const lines = [];

    for (const line of dto.lines) {
      const item = await this.prisma.item.findUnique({
        where: { id: line.itemId },
        include: { baseUom: true },
      });

      if (!item) {
        throw new BadRequestException("One or more items do not exist.");
      }

      const events = await this.prisma.ledgerEvent.findMany({
        where: {
          locationId: dto.sourceLocationId,
          itemId: line.itemId,
        },
        orderBy: [{ businessDate: "asc" }, { createdAt: "asc" }],
      });
      const state = this.costingService.calculateState(events);
      const reservedQty = await this.reservedOutQty(
        dto.sourceLocationId,
        line.itemId,
      );
      const availableQty = state.qtyOnHand.sub(reservedQty);
      const requestedQty = new Prisma.Decimal(line.qty);

      if (availableQty.lte(0)) {
        throw new ConflictException(
          `No source stock available for ${item.sku}.`,
        );
      }

      if (availableQty.lt(requestedQty)) {
        throw new ConflictException(
          `Transfer quantity for ${item.sku} exceeds available source stock.`,
        );
      }

      const remainingQty = availableQty.sub(requestedQty);
      const lowStockAfterRequest =
        item.lowStockThreshold !== null &&
        remainingQty.lte(item.lowStockThreshold);

      lines.push({
        itemId: line.itemId,
        qty: line.qty,
        availableQty,
        remainingQty,
        lowStockThreshold: item.lowStockThreshold,
        lowStockAfterRequest,
      });
    }

    return lines;
  }

  private async postConfirmedTransferMovement(
    tx: Prisma.TransactionClient,
    transfer: Prisma.TransferGetPayload<{ include: typeof transferInclude }>,
    line: Prisma.TransferLineGetPayload<{
      include: { item: { include: { baseUom: true } } };
    }>,
    qty: Prisma.Decimal,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata,
    receiveStep: string,
  ) {
    const outbound = await this.ledgerService.postEventInTransaction(
      tx,
      {
        uuid: randomUUID(),
        locationId: transfer.sourceLocationId,
        itemId: line.itemId,
        transactionType: TransactionType.TRANSFER_OUT,
        qtyOut: qty.toNumber(),
        unitCostAtTime: Number(line.unitCost ?? 0),
        referenceType: ReferenceType.TRANSFER,
        referenceId: transfer.id,
        businessDate: new Date().toISOString(),
        approvedById: user.id,
          metadata: {
            transferNumber: transfer.transferNumber,
            targetLocationId: transfer.targetLocationId,
            receiveStep: `${receiveStep}_out`,
          },
      },
      user,
      metadata,
    );

    await this.ledgerService.postEventInTransaction(
      tx,
      {
        uuid: randomUUID(),
        locationId: transfer.targetLocationId,
        itemId: line.itemId,
        transactionType: TransactionType.TRANSFER_IN,
        qtyIn: qty.toNumber(),
        unitCostAtTime: Number(line.unitCost ?? 0),
        referenceType: ReferenceType.TRANSFER,
        referenceId: transfer.id,
        businessDate: new Date().toISOString(),
        approvedById: user.id,
          metadata: {
            transferNumber: transfer.transferNumber,
            sourceLocationId: transfer.sourceLocationId,
            receiveStep: `${receiveStep}_in`,
          },
      },
      user,
      metadata,
    );

    return outbound;
  }

  private async currentAverageUnitCost(locationId: string, itemId: string) {
    const events = await this.prisma.ledgerEvent.findMany({
      where: { locationId, itemId },
      orderBy: [{ businessDate: "asc" }, { createdAt: "asc" }],
    });

    return this.costingService.calculateState(events).averageUnitCost;
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

  private linesById<T extends "pickedQty" | "receivedQty">(
    lines: Array<{ lineId: string } & Record<T, number>>,
    qtyKey: T,
  ) {
    return new Map(lines.map((line) => [line.lineId, line[qtyKey]]));
  }

  private assertUniqueItems(lines: Array<{ itemId: string }>) {
    const itemIds = lines.map((line) => line.itemId);

    if (new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException("Duplicate item lines are not allowed.");
    }
  }

  private async getTransferForAction(id: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: transferInclude,
    });

    if (!transfer) {
      throw new NotFoundException("Transfer not found.");
    }

    return transfer;
  }

  private async findTransferForUpdate(
    tx: Prisma.TransactionClient,
    id: string,
  ) {
    const transfer = await tx.transfer.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!transfer) {
      throw new NotFoundException("Transfer not found.");
    }

    return transfer;
  }

  private async nextTransferNumber(tx: Prisma.TransactionClient) {
    return nextBusinessDocumentNumber(tx, "TR");
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
    entity: { id: string; sourceLocationId: string; targetLocationId: string },
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata,
  ) {
    await tx.auditLog.create({
      data: {
        userId: user.id,
        module: "transfers",
        action,
        entityType: "Transfer",
        entityId: entity.id,
        locationId: entity.sourceLocationId,
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
