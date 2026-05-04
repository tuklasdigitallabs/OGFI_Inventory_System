import { BadRequestException } from '@nestjs/common';
import {
  Prisma,
  ReferenceType,
  RoleCode,
  TransactionType,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/types';
import { LedgerService } from './ledger.service';

const baseLocationId = '44444444-4444-4444-4444-444444444444';

const user: AuthenticatedUser = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'admin@example.com',
  username: 'admin',
  fullName: 'Admin User',
  role: {
    id: '22222222-2222-2222-2222-222222222222',
    code: RoleCode.ADMIN,
    name: 'Admin',
  },
  permissions: [],
  locationIds: [baseLocationId],
};

const baseDto = {
  uuid: '33333333-3333-3333-3333-333333333333',
  locationId: baseLocationId,
  itemId: '55555555-5555-5555-5555-555555555555',
  unitCostAtTime: 12.5,
  referenceType: ReferenceType.ADJUSTMENT,
  referenceId: '66666666-6666-6666-6666-666666666666',
  businessDate: '2026-05-05T00:00:00.000Z',
};

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: '77777777-7777-7777-7777-777777777777',
    uuid: overrides.uuid ?? baseDto.uuid,
    locationId: overrides.locationId ?? baseDto.locationId,
    itemId: overrides.itemId ?? baseDto.itemId,
    transactionType: overrides.transactionType ?? TransactionType.ADJUSTMENT,
    qtyIn: overrides.qtyIn ?? new Prisma.Decimal(0),
    qtyOut: overrides.qtyOut ?? new Prisma.Decimal(0),
    unitCostAtTime:
      overrides.unitCostAtTime ?? new Prisma.Decimal(baseDto.unitCostAtTime),
    extendedCost: overrides.extendedCost ?? new Prisma.Decimal(0),
    referenceType: overrides.referenceType ?? ReferenceType.ADJUSTMENT,
    referenceId: overrides.referenceId ?? baseDto.referenceId,
    businessDate: overrides.businessDate ?? new Date(baseDto.businessDate),
    createdById: overrides.createdById ?? user.id,
    approvedById: overrides.approvedById ?? null,
    reversalOfId: overrides.reversalOfId ?? null,
    metadata: overrides.metadata ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-05-05T01:00:00.000Z'),
  };
}

function makeTx() {
  const tx = {
    ledgerEvent: {
      findUnique: jest.fn(),
      create: jest.fn(({ data }) => Promise.resolve(makeEvent(data))),
    },
    location: {
      findFirst: jest.fn().mockResolvedValue({ id: baseDto.locationId }),
    },
    item: {
      findFirst: jest.fn().mockResolvedValue({ id: baseDto.itemId }),
    },
    user: {
      findFirst: jest.fn(),
    },
    reasonCode: {
      findFirst: jest.fn(),
    },
    auditLog: {
      create: jest
        .fn()
        .mockResolvedValue({ id: '88888888-8888-8888-8888-888888888888' }),
    },
    purchaseOrder: {
      findUnique: jest.fn(),
    },
    receiving: {
      findUnique: jest.fn(),
    },
    transfer: {
      findUnique: jest.fn(),
    },
    wastage: {
      findUnique: jest.fn(),
    },
    stockCount: {
      findUnique: jest.fn(),
    },
    issueToOps: {
      findUnique: jest.fn(),
    },
    salesBatch: {
      findUnique: jest.fn(),
    },
    syncBatch: {
      findUnique: jest.fn(),
    },
  };

  return tx;
}

function makeService(tx = makeTx()) {
  const prisma = {
    $transaction: jest.fn((callback) => callback(tx)),
    ledgerEvent: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  return {
    tx,
    prisma,
    service: new LedgerService(prisma as never),
  };
}

describe('LedgerService', () => {
  it.each([
    [TransactionType.RECEIVE, 5, 0],
    [TransactionType.TRANSFER_IN, 5, 0],
    [TransactionType.TRANSFER_OUT, 0, 5],
    [TransactionType.WASTAGE, 0, 5],
    [TransactionType.ISSUE_TO_OPS, 0, 5],
    [TransactionType.SALE_CONSUMPTION, 0, 5],
    [TransactionType.STOCK_COUNT, 5, 0],
    [TransactionType.ADJUSTMENT, 0, 5],
  ])(
    'posts %s events with valid quantity direction',
    async (transactionType, qtyIn, qtyOut) => {
      const { service, tx } = makeService();
      tx.ledgerEvent.findUnique.mockResolvedValue(null);

      const result = await service.postEvent(
        {
          ...baseDto,
          transactionType,
          qtyIn,
          qtyOut,
        },
        user,
      );

      expect(result.status).toBe('posted');
      expect(tx.ledgerEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transactionType,
            qtyIn: new Prisma.Decimal(qtyIn),
            qtyOut: new Prisma.Decimal(qtyOut),
            extendedCost: new Prisma.Decimal(62.5),
          }),
        }),
      );
      expect(tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            module: 'ledger',
            action: 'ledger.events.posted',
            entityType: 'LedgerEvent',
          }),
        }),
      );
    },
  );

  it('returns the existing event for duplicate UUIDs without writing another row', async () => {
    const existing = makeEvent({
      qtyIn: new Prisma.Decimal(5),
      extendedCost: new Prisma.Decimal(62.5),
    });
    const { service, tx } = makeService();
    tx.ledgerEvent.findUnique.mockResolvedValue(existing);

    const result = await service.postEvent(
      {
        ...baseDto,
        transactionType: TransactionType.RECEIVE,
        qtyIn: 0,
        qtyOut: 0,
      },
      user,
    );

    expect(result.status).toBe('already_posted');
    expect(result.idempotent).toBe(true);
    expect(tx.ledgerEvent.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects invalid quantity combinations', async () => {
    const { service, tx } = makeService();
    tx.ledgerEvent.findUnique.mockResolvedValue(null);

    await expect(
      service.postEvent(
        {
          ...baseDto,
          transactionType: TransactionType.RECEIVE,
          qtyIn: 5,
          qtyOut: 1,
        },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.ledgerEvent.create).not.toHaveBeenCalled();
  });

  it('posts a reversal with inverted quantities and an audit log', async () => {
    const original = makeEvent({
      id: '99999999-9999-9999-9999-999999999999',
      transactionType: TransactionType.TRANSFER_OUT,
      qtyIn: new Prisma.Decimal(0),
      qtyOut: new Prisma.Decimal(8),
      extendedCost: new Prisma.Decimal(100),
    });
    const { service, tx } = makeService();
    tx.ledgerEvent.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...original, reversals: [] });

    const result = await service.reverseEvent(
      original.id,
      {
        uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        reason: 'Correction',
      },
      user,
    );

    expect(result.status).toBe('posted');
    expect(tx.ledgerEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          qtyIn: original.qtyOut,
          qtyOut: original.qtyIn,
          reversalOfId: original.id,
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ledger.events.reversed',
          after: expect.objectContaining({
            originalEventId: original.id,
            originalEventUuid: original.uuid,
          }),
        }),
      }),
    );
  });
});
