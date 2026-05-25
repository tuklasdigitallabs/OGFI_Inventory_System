import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PurchasingService } from "./purchasing.service";

function makeService() {
  const prisma = {};

  return {
    service: new PurchasingService(prisma as never),
  };
}

function makeTx() {
  return {
    item: {
      findFirst: jest.fn().mockResolvedValue({
        baseUomId: "22222222-2222-2222-2222-222222222222",
        sku: "RICE-JAPANESE",
      }),
    },
    supplierItem: {
      findFirst: jest.fn(),
    },
    uomConversion: {
      findUnique: jest.fn().mockResolvedValue({
        factor: new Prisma.Decimal(25),
      }),
    },
  };
}

describe("PurchasingService", () => {
  it("converts standalone receiving quantity and cost to item base UOM", async () => {
    const { service } = makeService();
    const tx = makeTx();

    const result = await (service as any).receivingLedgerCost(
      tx,
      {
        itemId: "11111111-1111-1111-1111-111111111111",
        acceptedQty: new Prisma.Decimal(2),
        unitCost: new Prisma.Decimal(2500),
      },
      undefined,
      {
        itemId: "11111111-1111-1111-1111-111111111111",
        uomId: "33333333-3333-3333-3333-333333333333",
      },
    );

    expect(result.qtyIn).toEqual(new Prisma.Decimal(50));
    expect(result.unitCostAtTime).toEqual(new Prisma.Decimal(100));
  });

  it("rejects standalone receiving when UOM conversion is missing", async () => {
    const { service } = makeService();
    const tx = makeTx();
    tx.uomConversion.findUnique.mockResolvedValue(null);

    await expect(
      (service as any).receivingLedgerCost(
        tx,
        {
          itemId: "11111111-1111-1111-1111-111111111111",
          acceptedQty: new Prisma.Decimal(2),
          unitCost: new Prisma.Decimal(2500),
        },
        undefined,
        {
          itemId: "11111111-1111-1111-1111-111111111111",
          uomId: "33333333-3333-3333-3333-333333333333",
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
