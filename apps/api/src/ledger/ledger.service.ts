import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LedgerEvent,
  Prisma,
  ReferenceType,
  TransactionType,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';
import { PostLedgerEventDto } from './dto/post-ledger-event.dto';
import { ReverseLedgerEventDto } from './dto/reverse-ledger-event.dto';

interface RequestAuditMetadata {
  ipAddress?: string;
  userAgent?: string;
}

type LedgerEventResponse = Omit<
  LedgerEvent,
  'qtyIn' | 'qtyOut' | 'unitCostAtTime' | 'extendedCost' | 'metadata'
> & {
  qtyIn: string;
  qtyOut: string;
  unitCostAtTime: string;
  extendedCost: string;
  metadata: Prisma.JsonValue | null;
};

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
  constructor(private readonly prisma: PrismaService) {}

  async list(resource: string, query: Record<string, string> = {}) {
    if (resource === 'inventory.movements') {
      const events = await this.prisma.ledgerEvent.findMany({
        where: {
          locationId: query.locationId,
          itemId: query.itemId,
          transactionType: query.transactionType as TransactionType | undefined,
        },
        orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }],
        take: this.parseTake(query.take),
      });

      return {
        resource,
        data: events.map((event) => this.toResponse(event)),
      };
    }

    if (resource === 'ledger.events.detail') {
      const event = await this.prisma.ledgerEvent.findUnique({
        where: { id: query.id },
      });

      if (!event) {
        throw new NotFoundException('Ledger event not found.');
      }

      return this.toResponse(event);
    }

    return {
      resource,
      status: 'deferred',
      query,
    };
  }

  async postEvent(
    dto: PostLedgerEventDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.ledgerEvent.findUnique({
        where: { uuid: dto.uuid },
      });

      if (existing) {
        return {
          status: 'already_posted',
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
      const unitCostAtTime = new Prisma.Decimal(dto.unitCostAtTime);
      const extendedCost = quantities.movementQty.mul(unitCostAtTime);

      await this.validatePostTargets(
        tx,
        dto.locationId,
        dto.itemId,
        dto.approvedById,
        dto.reasonCodeId,
      );
      await this.validateReference(tx, dto.referenceType, dto.referenceId);

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
        'ledger.events.posted',
        event,
        user,
        metadata,
        dto.reasonCodeId,
      );

      return {
        status: 'posted',
        idempotent: false,
        event: this.toResponse(event),
      };
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
          status: 'already_posted',
          idempotent: true,
          event: this.toResponse(existing),
        };
      }

      const original = await tx.ledgerEvent.findUnique({
        where: { id },
        include: { reversals: true },
      });

      if (!original) {
        throw new NotFoundException('Ledger event not found.');
      }

      if (original.reversalOfId) {
        throw new BadRequestException('Reversal events cannot be reversed.');
      }

      if (original.reversals.length > 0) {
        throw new ConflictException('Ledger event has already been reversed.');
      }

      this.assertUserCanAccessLocation(user, original.locationId);

      const referenceType = dto.referenceType ?? original.referenceType;
      const referenceId = dto.referenceId ?? original.referenceId;

      await this.validatePostTargets(
        tx,
        original.locationId,
        original.itemId,
        dto.approvedById,
        dto.reasonCodeId,
      );
      await this.validateReference(tx, referenceType, referenceId);

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
        'ledger.events.reversed',
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
        status: 'posted',
        idempotent: false,
        event: this.toResponse(event),
      };
    });
  }

  private assertUserCanAccessLocation(
    user: AuthenticatedUser,
    locationId: string,
  ) {
    if (!user.locationIds.includes(locationId)) {
      throw new ForbiddenException('Location access denied.');
    }
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
        'Exactly one of qtyIn or qtyOut must be greater than zero.',
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
      throw new BadRequestException('Location does not exist or is inactive.');
    }

    if (!item) {
      throw new BadRequestException('Item does not exist or is inactive.');
    }

    if (approvedById && !approver) {
      throw new BadRequestException('Approver does not exist or is inactive.');
    }

    if (reasonCodeId && !reasonCode) {
      throw new BadRequestException(
        'Reason code does not exist or is inactive.',
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
      case ReferenceType.SYNC_BATCH:
        return tx.syncBatch.findUnique({
          where: { id: referenceId },
          select: { id: true },
        });
      case ReferenceType.ADJUSTMENT:
        return Promise.resolve({ id: referenceId });
      default:
        return Promise.resolve(null);
    }
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
        module: 'ledger',
        action,
        entityType: 'LedgerEvent',
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

  private parseTake(rawTake?: string) {
    if (!rawTake) {
      return 100;
    }

    const take = Number(rawTake);
    return Number.isInteger(take) && take > 0 && take <= 500 ? take : 100;
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
}
