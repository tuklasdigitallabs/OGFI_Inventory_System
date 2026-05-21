import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { RunReportDto } from "./dto/reports.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("catalog")
  @Permissions("reports:read")
  catalog() {
    return this.reportsService.catalog();
  }

  @Post("runs")
  @Permissions("reports:run")
  runReport(
    @Body() body: RunReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.runReport(body, user);
  }

  @Get("runs")
  @Permissions("reports:read")
  listRuns(
    @Query() query: Record<string, string>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.listRuns(query, user);
  }

  @Get("runs/:id")
  @Permissions("reports:read")
  getRun(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getRun(id, user);
  }

  @Get("runs/:id/download")
  @Permissions("reports:read")
  downloadRun(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.downloadRun(id, user);
  }
}
