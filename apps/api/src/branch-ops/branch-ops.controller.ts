import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types";
import { LocationAccess } from "../rbac/decorators/location-access.decorator";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { BranchOpsService } from "./branch-ops.service";
import {
  CreateEmergencyPurchaseDto,
  CreateIssueToOpsDto,
  CreateSalesBatchDto,
  CreateWastageDto,
  SubmitStockCountDto,
} from "./dto/branch-ops.dto";

@Controller("branch")
export class BranchOpsController {
  constructor(private readonly branchOpsService: BranchOpsService) {}

  @Post("wastage")
  @Permissions("branch.wastage:create")
  @LocationAccess({ source: "body", key: "locationId" })
  createWastage(
    @Body() body: CreateWastageDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.branchOpsService.createWastage(body, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Get("wastage")
  @Permissions("branch.wastage:read")
  @LocationAccess({ source: "query", key: "locationId" })
  listWastage(
    @Query() query: Record<string, string>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branchOpsService.list("wastage", query, user);
  }

  @Post("stock-counts")
  @Permissions("branch.stock-counts:submit")
  @LocationAccess({ source: "body", key: "locationId" })
  submitStockCount(
    @Body() body: SubmitStockCountDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.branchOpsService.submitStockCount(body, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Get("stock-counts")
  @Permissions("branch.stock-counts:read")
  @LocationAccess({ source: "query", key: "locationId" })
  listStockCounts(
    @Query() query: Record<string, string>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branchOpsService.list("stock-counts", query, user);
  }

  @Get("stock-counts/:id")
  @Permissions("branch.stock-counts:read")
  getStockCount(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branchOpsService.list("stock-counts.detail", { id }, user);
  }

  @Post("issues")
  @Permissions("branch.issues:create")
  @LocationAccess({ source: "body", key: "locationId" })
  createIssueToOps(
    @Body() body: CreateIssueToOpsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.branchOpsService.createIssueToOps(body, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Get("issues")
  @Permissions("branch.issues:read")
  @LocationAccess({ source: "query", key: "locationId" })
  listIssues(
    @Query() query: Record<string, string>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branchOpsService.list("issues", query, user);
  }

  @Post("emergency-purchases")
  @Permissions("branch.emergency-purchases:create")
  @LocationAccess({ source: "body", key: "locationId" })
  createEmergencyPurchase(
    @Body() body: CreateEmergencyPurchaseDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.branchOpsService.createEmergencyPurchase(body, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Get("emergency-purchases")
  @Permissions("branch.emergency-purchases:read")
  @LocationAccess({ source: "query", key: "locationId" })
  listEmergencyPurchases(
    @Query() query: Record<string, string>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branchOpsService.list("emergency-purchases", query, user);
  }

  @Post("sales-batches")
  @Permissions("branch.sales-batches:create")
  @LocationAccess({ source: "body", key: "locationId" })
  createSalesBatch(
    @Body() body: CreateSalesBatchDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.branchOpsService.createSalesBatch(body, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Get("sales-batches")
  @Permissions("branch.sales-batches:read")
  @LocationAccess({ source: "query", key: "locationId" })
  listSalesBatches(
    @Query() query: Record<string, string>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branchOpsService.list("sales-batches", query, user);
  }
}
