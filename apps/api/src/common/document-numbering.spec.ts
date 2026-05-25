import { nextBusinessDocumentNumber } from "./document-numbering";

describe("nextBusinessDocumentNumber", () => {
  it("formats a database-backed sequence value", async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ value: 12 }]),
    };

    await expect(
      nextBusinessDocumentNumber(
        tx as never,
        "PO",
        new Date("2026-05-26T03:30:00.000Z"),
      ),
    ).resolves.toBe("PO-20260526-0012");
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
