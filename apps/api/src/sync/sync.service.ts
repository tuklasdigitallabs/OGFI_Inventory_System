import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  ReferenceType,
  SyncBatch,
  SyncBatchStatus,
  SyncEvent,
  SyncEventStatus,
  TransactionType,
} from "@prisma/client";
import { AuthenticatedUser } from "../auth/types";
import { BranchOpsService } from "../branch-ops/branch-ops.service";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { SubmitSyncBatchDto, SubmitSyncEventDto } from "./dto/sync.dto";

const allowedOfflineEventTypes = new Set<TransactionType>([
  TransactionType.WASTAGE,
  TransactionType.STOCK_COUNT,
  TransactionType.ADJUSTMENT,
  TransactionType.ISSUE_TO_OPS,
  TransactionType.SALE_CONSUMPTION,
]);

type SyncBatchWithEvents = SyncBatch & { events: SyncEvent[] };

@Injectable()
export class SyncService {
  constructor(
    private readonly branchOpsService: BranchOpsService,
    private readonly ledgerService: LedgerService,
    private readonly prisma: PrismaService,
  ) {}

  async bootstrap(user: AuthenticatedUser) {
    const [locations, items, uoms, reasonCodes, devices] = await Promise.all([
      this.prisma.location.findMany({
        where: { id: { in: user.locationIds }, active: true },
        orderBy: { code: "asc" },
      }),
      this.prisma.item.findMany({
        where: { active: true },
        include: { baseUom: true, category: true },
        orderBy: { sku: "asc" },
        take: 1000,
      }),
      this.prisma.uom.findMany({
        where: { active: true },
        orderBy: { code: "asc" },
      }),
      this.prisma.reasonCode.findMany({
        where: { active: true },
        orderBy: [{ type: "asc" }, { code: "asc" }],
      }),
      this.prisma.syncDevice.findMany({
        where: {
          active: true,
          OR: [{ locationId: { in: user.locationIds } }, { locationId: null }],
        },
        include: { location: true },
        orderBy: [{ locationId: "asc" }, { deviceCode: "asc" }],
      }),
    ]);

    return {
      resource: "sync.bootstrap",
      data: {
        allowedEventTypes: [...allowedOfflineEventTypes],
        devices: devices.map((device) => ({
          id: device.id,
          deviceCode: device.deviceCode,
          name: device.name,
          type: device.type,
          locationId: device.locationId,
          locationCode: device.location?.code ?? null,
          locationName: device.location?.name ?? null,
        })),
        locations,
        items: items.map((item) => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          itemType: item.itemType,
          baseUomCode: item.baseUom.code,
          categoryName: item.category?.name ?? null,
        })),
        reasonCodes,
        serverTime: new Date().toISOString(),
      },
    };
  }

  async status(user: AuthenticatedUser) {
    const batches = await this.prisma.syncBatch.findMany({
      where: { locationId: { in: user.locationIds } },
      include: { events: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const pending = batches.filter((batch) =>
      [SyncBatchStatus.RECEIVED, SyncBatchStatus.PROCESSING].some(
        (status) => status === batch.status,
      ),
    ).length;
    const rejected = batches.reduce(
      (total, batch) =>
        total +
        batch.events.filter(
          (event) => event.status === SyncEventStatus.REJECTED,
        ).length,
      0,
    );

    return {
      resource: "sync.status",
      data: {
        pending,
        rejected,
        recentBatches: batches.map((batch) => this.toBatchResponse(batch)),
        serverTime: new Date().toISOString(),
      },
    };
  }

  async listBatches(query: Record<string, string>, user: AuthenticatedUser) {
    const batches = await this.prisma.syncBatch.findMany({
      where: {
        locationId: query.locationId
          ? query.locationId
          : { in: user.locationIds },
      },
      include: { events: true },
      orderBy: { createdAt: "desc" },
      take: this.parseTake(query.take),
    });

    return {
      resource: "sync.batches",
      data: batches
        .filter((batch) => user.locationIds.includes(batch.locationId))
        .map((batch) => this.toBatchResponse(batch)),
    };
  }

  async getBatch(id: string, user: AuthenticatedUser) {
    const batch = await this.prisma.syncBatch.findUnique({
      where: { id },
      include: { events: true },
    });

    if (!batch || !user.locationIds.includes(batch.locationId)) {
      throw new NotFoundException("Sync batch not found.");
    }

    return this.toBatchResponse(batch);
  }

  async submitBatch(dto: SubmitSyncBatchDto, user: AuthenticatedUser) {
    this.assertUserCanAccessLocation(dto.locationId, user);
    await this.assertDeviceCanSync(dto.deviceId, dto.locationId);

    const existing = await this.prisma.syncBatch.findUnique({
      where: { uuid: dto.uuid },
      include: { events: true },
    });

    if (existing) {
      return {
        status: "already_received",
        idempotent: true,
        batch: this.toBatchResponse(existing),
      };
    }

    const repeatedEvents = this.repeatedEventUuids(dto.events);
    const duplicateEvents = new Set([
      ...(await this.findDuplicateEvents(dto.events)),
      ...repeatedEvents,
    ]);
    const rejectedBeforeCreate = dto.events.filter(
      (event) =>
        !allowedOfflineEventTypes.has(event.eventType) &&
        !duplicateEvents.has(event.uuid),
    );
    const acceptedEvents = dto.events.filter(
      (event) =>
        allowedOfflineEventTypes.has(event.eventType) &&
        !duplicateEvents.has(event.uuid),
    );

    const batch = await this.prisma.syncBatch.create({
      data: {
        uuid: dto.uuid,
        deviceId: dto.deviceId,
        locationId: dto.locationId,
        submittedById: user.id,
        status: SyncBatchStatus.RECEIVED,
        clientCreatedAt: new Date(dto.clientCreatedAt),
        appVersion: dto.appVersion,
        error:
          acceptedEvents.length === 0
            ? "No new processable events in batch."
            : undefined,
        events: {
          create: [
            ...acceptedEvents.map((event) => ({
              uuid: event.uuid,
              eventType: event.eventType,
              payload: event.payload as unknown as Prisma.InputJsonValue,
            })),
            ...rejectedBeforeCreate.map((event) => ({
              uuid: event.uuid,
              eventType: event.eventType,
              payload: event.payload as unknown as Prisma.InputJsonValue,
              status: SyncEventStatus.REJECTED,
              rejectionReason: `${event.eventType} is not allowed offline.`,
            })),
          ],
        },
      },
      include: { events: true },
    });

    if (acceptedEvents.length === 0) {
      const completed = await this.prisma.syncBatch.update({
        where: { id: batch.id },
        data: { status: SyncBatchStatus.COMPLETED_WITH_REJECTIONS },
        include: { events: true },
      });

      return {
        status: "completed_with_rejections",
        duplicateEventUuids: [...duplicateEvents],
        idempotent: false,
        batch: this.toBatchResponse(completed),
      };
    }

    const processed = await this.processBatch(batch.id, user);

    return {
      status: processed.status.toLowerCase(),
      duplicateEventUuids: [...duplicateEvents],
      idempotent: false,
      batch: this.toBatchResponse(processed),
    };
  }

  private async processBatch(batchId: string, user: AuthenticatedUser) {
    await this.prisma.syncBatch.update({
      where: { id: batchId },
      data: { status: SyncBatchStatus.PROCESSING },
    });

    const batch = await this.prisma.syncBatch.findUniqueOrThrow({
      where: { id: batchId },
      include: { events: true },
    });

    for (const event of batch.events.filter(
      (syncEvent) => syncEvent.status === SyncEventStatus.PENDING,
    )) {
      try {
        const payload = event.payload as SyncEventPayload;
        const result = this.isBranchOperationEvent(event.eventType)
          ? await this.processBranchOperationEvent(batch, event, payload, user)
          : await this.ledgerService.postEvent(
              {
                uuid: event.uuid,
                locationId: batch.locationId,
                itemId: payload.itemId,
                transactionType: event.eventType,
                qtyIn: payload.qtyIn,
                qtyOut: payload.qtyOut,
                unitCostAtTime: payload.unitCostAtTime,
                referenceType: ReferenceType.SYNC_BATCH,
                referenceId: batch.id,
                businessDate: payload.businessDate,
                reasonCodeId: payload.reasonCodeId,
                metadata: {
                  ...(payload.metadata ?? {}),
                  deviceId: batch.deviceId,
                  offline: true,
                  submittedById: user.id,
                  syncBatchId: batch.id,
                  syncEventId: event.id,
                  workingLocationId: batch.locationId,
                },
              },
              user,
            );

        await this.prisma.syncEvent.update({
          where: { id: event.id },
          data: {
            status: result.idempotent
              ? SyncEventStatus.ALREADY_PROCESSED
              : SyncEventStatus.PROCESSED,
            processedAt: new Date(),
          },
        });
      } catch (error) {
        await this.prisma.syncEvent.update({
          where: { id: event.id },
          data: {
            status: SyncEventStatus.REJECTED,
            rejectionReason:
              error instanceof Error
                ? error.message
                : "Unable to process event.",
            processedAt: new Date(),
          },
        });
      }
    }

    const events = await this.prisma.syncEvent.findMany({
      where: { syncBatchId: batchId },
    });
    const rejectedCount = events.filter(
      (event) => event.status === SyncEventStatus.REJECTED,
    ).length;
    const nextStatus =
      rejectedCount > 0
        ? SyncBatchStatus.COMPLETED_WITH_REJECTIONS
        : SyncBatchStatus.COMPLETED;

    const completed = await this.prisma.syncBatch.update({
      where: { id: batchId },
      data: { status: nextStatus },
      include: { events: true },
    });

    await this.prisma.syncDevice.updateMany({
      where: { deviceCode: batch.deviceId },
      data: { lastSeenAt: new Date() },
    });

    return completed;
  }

  private async processBranchOperationEvent(
    batch: SyncBatch,
    event: SyncEvent,
    payload: SyncEventPayload,
    user: AuthenticatedUser,
  ) {
    if (!payload.qtyOut || payload.qtyOut <= 0) {
      throw new BadRequestException(`${event.eventType} requires qtyOut.`);
    }

    const baseUomId = await this.activeItemBaseUomId(payload.itemId);
    const remarks =
      typeof payload.metadata?.remarks === "string"
        ? payload.metadata.remarks
        : undefined;

    if (event.eventType === TransactionType.WASTAGE) {
      if (!payload.reasonCodeId) {
        throw new BadRequestException("WASTAGE requires a reason code.");
      }

      await this.branchOpsService.createWastage(
        {
          businessDate: payload.businessDate,
          lines: [
            {
              itemId: payload.itemId,
              qty: payload.qtyOut,
              uomId: baseUomId,
            },
          ],
          locationId: batch.locationId,
          reasonCodeId: payload.reasonCodeId,
          remarks,
        },
        user,
      );
    }

    if (event.eventType === TransactionType.ISSUE_TO_OPS) {
      await this.branchOpsService.createIssueToOps(
        {
          businessDate: payload.businessDate,
          lines: [
            {
              itemId: payload.itemId,
              qty: payload.qtyOut,
              uomId: baseUomId,
            },
          ],
          locationId: batch.locationId,
          remarks,
        },
        user,
      );
    }

    if (event.eventType === TransactionType.SALE_CONSUMPTION) {
      await this.branchOpsService.createSalesBatch(
        {
          businessDate: payload.businessDate,
          lines: [
            {
              itemId: payload.itemId,
              qtySold: payload.qtyOut,
              uomId: baseUomId,
            },
          ],
          locationId: batch.locationId,
          sourceFileUrl: undefined,
        },
        user,
      );
    }

    return {
      idempotent: false,
      status: "posted",
    };
  }

  private isBranchOperationEvent(eventType: TransactionType) {
    const branchOperationEvents: TransactionType[] = [
      TransactionType.WASTAGE,
      TransactionType.ISSUE_TO_OPS,
      TransactionType.SALE_CONSUMPTION,
    ];

    return branchOperationEvents.includes(eventType);
  }

  private async activeItemBaseUomId(itemId: string) {
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, active: true },
      select: { baseUomId: true },
    });

    if (!item) {
      throw new BadRequestException("Item does not exist or is inactive.");
    }

    return item.baseUomId;
  }

  private async findDuplicateEvents(events: SubmitSyncEventDto[]) {
    const existing = await this.prisma.syncEvent.findMany({
      where: { uuid: { in: events.map((event) => event.uuid) } },
      select: { uuid: true },
    });

    return new Set(existing.map((event) => event.uuid));
  }

  private repeatedEventUuids(events: SubmitSyncEventDto[]) {
    const seen = new Set<string>();
    const repeated = new Set<string>();

    for (const event of events) {
      if (seen.has(event.uuid)) {
        repeated.add(event.uuid);
      }

      seen.add(event.uuid);
    }

    return repeated;
  }

  private assertUserCanAccessLocation(
    locationId: string,
    user: AuthenticatedUser,
  ) {
    if (!user.locationIds.includes(locationId)) {
      throw new BadRequestException("Selected location is not allowed.");
    }
  }

  private async assertDeviceCanSync(deviceId: string, locationId: string) {
    const device = await this.prisma.syncDevice.findUnique({
      where: { deviceCode: deviceId },
    });

    if (!device || !device.active) {
      throw new BadRequestException(
        "Selected sync device is not registered or active.",
      );
    }

    if (device.locationId && device.locationId !== locationId) {
      throw new BadRequestException(
        "Selected sync device is assigned to a different location.",
      );
    }
  }

  private parseTake(value?: string) {
    const take = Number(value);

    if (!Number.isFinite(take)) {
      return 50;
    }

    return Math.max(1, Math.min(100, Math.trunc(take)));
  }

  private toBatchResponse(batch: SyncBatchWithEvents) {
    return {
      id: batch.id,
      uuid: batch.uuid,
      deviceId: batch.deviceId,
      locationId: batch.locationId,
      submittedById: batch.submittedById,
      status: batch.status,
      clientCreatedAt: batch.clientCreatedAt.toISOString(),
      appVersion: batch.appVersion,
      error: batch.error,
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
      events: batch.events.map((event) => ({
        id: event.id,
        uuid: event.uuid,
        eventType: event.eventType,
        payload: event.payload,
        status: event.status,
        rejectionReason: event.rejectionReason,
        processedAt: event.processedAt?.toISOString() ?? null,
      })),
    };
  }
}

type SyncEventPayload = {
  itemId: string;
  qtyIn?: number;
  qtyOut?: number;
  unitCostAtTime: number;
  businessDate: string;
  reasonCodeId?: string;
  metadata?: Record<string, unknown>;
};
