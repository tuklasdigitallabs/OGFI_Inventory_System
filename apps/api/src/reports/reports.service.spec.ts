import { ReportFormat, ReportStatus, RoleCode } from "@prisma/client";
import { AuthenticatedUser } from "../auth/types";
import { ReportsService } from "./reports.service";

const user: AuthenticatedUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "admin@example.com",
  username: "admin",
  fullName: "Admin User",
  mustChangePassword: false,
  role: {
    id: "22222222-2222-2222-2222-222222222222",
    code: RoleCode.ADMIN,
    name: "Admin",
  },
  permissions: [],
  locationIds: ["33333333-3333-3333-3333-333333333333"],
};

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "44444444-4444-4444-4444-444444444444",
    reportKey: "stock-on-hand",
    status: ReportStatus.COMPLETED,
    format: ReportFormat.CSV,
    parameters: {
      dateFrom: null,
      dateTo: null,
      itemType: null,
      locationId: user.locationIds[0],
      locationIds: user.locationIds,
    },
    outputUrl: "/api/reports/runs/44444444-4444-4444-4444-444444444444/download",
    outputContent: "Location,SKU\nBranch 1,RICE",
    scopeLocationIds: user.locationIds,
    error: null,
    requestedById: user.id,
    startedAt: new Date("2026-05-26T01:00:00.000Z"),
    completedAt: new Date("2026-05-26T01:01:00.000Z"),
    createdAt: new Date("2026-05-26T01:00:00.000Z"),
    updatedAt: new Date("2026-05-26T01:01:00.000Z"),
    ...overrides,
  };
}

function makeService() {
  const prisma = {
    reportRun: {
      create: jest.fn().mockResolvedValue(makeRun({ status: ReportStatus.PROCESSING })),
      findMany: jest.fn().mockResolvedValue([makeRun()]),
      findUnique: jest.fn().mockResolvedValue(makeRun()),
      update: jest.fn(({ data }) => Promise.resolve(makeRun(data))),
    },
  };

  return {
    prisma,
    service: new ReportsService(prisma as never),
  };
}

describe("ReportsService", () => {
  it("stores generated CSV content when a report completes", async () => {
    const { prisma, service } = makeService();
    jest.spyOn(service as any, "buildReport").mockResolvedValue({
      columns: ["Location", "SKU"],
      rows: [["Branch 1", "RICE"]],
    });

    await service.runReport(
      { reportKey: "stock-on-hand", format: "CSV", locationId: user.locationIds[0] },
      user,
    );

    expect(prisma.reportRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scopeLocationIds: user.locationIds,
        }),
      }),
    );
    expect(prisma.reportRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outputContent: "Location,SKU\nBranch 1,RICE",
          status: ReportStatus.COMPLETED,
        }),
      }),
    );
  });

  it("downloads the stored report snapshot instead of rebuilding live data", async () => {
    const { service } = makeService();
    const buildReport = jest
      .spyOn(service as any, "buildReport")
      .mockRejectedValue(new Error("should not rebuild"));

    await expect(
      service.downloadRun("44444444-4444-4444-4444-444444444444", user),
    ).resolves.toEqual(
      expect.objectContaining({
        content: "Location,SKU\nBranch 1,RICE",
        contentType: "text/csv",
      }),
    );
    expect(buildReport).not.toHaveBeenCalled();
  });

  it("filters report runs by stored scope locations in the database", async () => {
    const { prisma, service } = makeService();

    await service.listRuns({}, user);

    expect(prisma.reportRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { scopeLocationIds: { hasSome: user.locationIds } },
            { scopeLocationIds: { isEmpty: true } },
          ],
        }),
      }),
    );
  });
});
