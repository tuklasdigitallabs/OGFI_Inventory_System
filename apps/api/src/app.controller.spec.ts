import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppController } from "./app.controller";

function makeController({
  failedMigration = [],
  webHealthUrl,
}: {
  failedMigration?: Array<{ migration_name: string }>;
  webHealthUrl?: string;
} = {}) {
  const prisma = {
    $queryRaw: jest
      .fn()
      .mockResolvedValueOnce([{ "?column?": 1 }])
      .mockResolvedValueOnce(failedMigration),
  };
  const config = {
    get: jest.fn((key: string) =>
      key === "WEB_HEALTH_URL" ? webHealthUrl : undefined,
    ),
  };

  return {
    controller: new AppController(
      config as unknown as ConfigService,
      prisma as never,
    ),
    prisma,
  };
}

describe("AppController", () => {
  it("returns liveness without dependency checks", () => {
    const { controller } = makeController();

    expect(controller.health()).toMatchObject({
      service: "og-inventory-api",
      status: "ok",
    });
  });

  it("returns readiness when database and migrations are healthy", async () => {
    const { controller } = makeController();

    await expect(controller.ready()).resolves.toMatchObject({
      checks: {
        api: { status: "ok" },
        database: { status: "ok" },
        migrations: { status: "ok" },
        web: { status: "skipped" },
      },
      status: "ok",
    });
  });

  it("fails readiness when a migration has not completed", async () => {
    const { controller } = makeController({
      failedMigration: [{ migration_name: "20260526000000_failed" }],
    });

    await expect(controller.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
