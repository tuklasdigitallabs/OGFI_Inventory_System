import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Public } from "./auth/decorators/public.decorator";
import { PrismaService } from "./prisma/prisma.service";

type HealthCheck = {
  status: "ok" | "error" | "skipped";
  detail?: string;
};

@Controller()
export class AppController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get("build-info")
  buildInfo() {
    return {
      service: "og-inventory-api",
      roleSelectorContract: "uuid-or-role-code",
    };
  }

  @Public()
  @Get("health")
  health() {
    return {
      service: "og-inventory-api",
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get("ready")
  async ready() {
    const checks = {
      api: { status: "ok" } satisfies HealthCheck,
      database: await this.databaseHealth(),
      migrations: await this.migrationHealth(),
      web: await this.webHealth(),
    };
    const status = Object.values(checks).some((check) => check.status === "error")
      ? "error"
      : "ok";
    const response = {
      checks,
      service: "og-inventory-api",
      status,
      timestamp: new Date().toISOString(),
    };

    if (status === "error") {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }

  private async databaseHealth(): Promise<HealthCheck> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok" };
    } catch {
      return { status: "error", detail: "Database connectivity check failed." };
    }
  }

  private async migrationHealth(): Promise<HealthCheck> {
    try {
      const failed = await this.prisma.$queryRaw<
        Array<{ migration_name: string }>
      >`
        SELECT migration_name
        FROM "_prisma_migrations"
        WHERE finished_at IS NULL
          AND rolled_back_at IS NULL
        LIMIT 1
      `;

      if (failed.length > 0) {
        return {
          status: "error",
          detail: `Migration ${failed[0].migration_name} has not completed.`,
        };
      }

      return { status: "ok" };
    } catch {
      return { status: "error", detail: "Migration status check failed." };
    }
  }

  private async webHealth(): Promise<HealthCheck> {
    const webHealthUrl = this.config.get<string>("WEB_HEALTH_URL");

    if (!webHealthUrl) {
      return { status: "skipped", detail: "WEB_HEALTH_URL is not configured." };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(webHealthUrl, {
        cache: "no-store",
        signal: controller.signal,
      });

      return response.ok
        ? { status: "ok" }
        : {
            status: "error",
            detail: `Web health returned HTTP ${response.status}.`,
          };
    } catch {
      return { status: "error", detail: "Web health check failed." };
    } finally {
      clearTimeout(timeout);
    }
  }
}
