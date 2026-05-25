import { Prisma } from "@prisma/client";
import { OpeningInventoryImportService } from "./opening-inventory-import.service";

function makeService() {
  const prisma = {
    item: {
      findMany: jest.fn(),
    },
    uom: {
      findMany: jest.fn(),
    },
    uomConversion: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  return {
    prisma,
    service: new OpeningInventoryImportService(prisma as never),
  };
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    sku: "RICE-JAPANESE",
    name: "Japanese Rice",
    baseUomId: "22222222-2222-2222-2222-222222222222",
    baseUom: {
      id: "22222222-2222-2222-2222-222222222222",
      code: "KG",
    },
    category: { name: "Raw Materials" },
    supplierItems: [
      {
        unitCost: new Prisma.Decimal(92),
      },
    ],
    ...overrides,
  };
}

function makeRow(overrides: Record<string, string | number> = {}) {
  return {
    category: "Raw Materials",
    count: "2",
    itemName: "Japanese Rice",
    loose: "0",
    purchaseUom: "",
    row: 2,
    sheet: "Opening Inventory",
    unitCost: "100",
    uom: "KG",
    ...overrides,
  };
}

describe("OpeningInventoryImportService", () => {
  it("returns a row error for invalid nonblank unit cost", async () => {
    const { prisma, service } = makeService();
    prisma.item.findMany.mockResolvedValue([makeItem()]);
    prisma.uom.findMany.mockResolvedValue([
      { id: "22222222-2222-2222-2222-222222222222", code: "KG" },
    ]);
    const errors: Array<{ errors: string[] }> = [];

    const rows = await (service as any).validateRows(
      [makeRow({ unitCost: "not-a-number" })],
      errors,
    );

    expect(rows).toHaveLength(0);
    expect(errors).toEqual([
      expect.objectContaining({
        errors: ["UNIT COST must be a valid non-negative number."],
      }),
    ]);
  });

  it("uses supplier default cost when unit cost is blank", async () => {
    const { prisma, service } = makeService();
    prisma.item.findMany.mockResolvedValue([makeItem()]);
    prisma.uom.findMany.mockResolvedValue([
      { id: "22222222-2222-2222-2222-222222222222", code: "KG" },
    ]);
    const errors: Array<{ errors: string[] }> = [];

    const rows = await (service as any).validateRows(
      [makeRow({ unitCost: "" })],
      errors,
    );

    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].unitCostAtTime).toEqual(new Prisma.Decimal(92));
  });
});
