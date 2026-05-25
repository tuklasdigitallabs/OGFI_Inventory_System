import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types";
import { LocationAccess } from "../rbac/decorators/location-access.decorator";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import {
  ApprovePurchaseOrderDto,
  ClosePurchaseOrderBalanceDto,
  CreatePurchaseOrderDto,
  CreateReceivingDto,
  RejectPurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from "./dto/purchasing.dto";
import { PurchasingService } from "./purchasing.service";

@Controller("purchasing")
export class PurchasingController {
  constructor(private readonly purchasingService: PurchasingService) {}

  @Get("purchase-orders")
  @Permissions("purchasing.purchase-orders:read")
  @LocationAccess({ source: "query", key: "locationId" })
  listPurchaseOrders(@Query() query: Record<string, string>) {
    return this.purchasingService.list("purchase-orders", query);
  }

  @Get("supplier-item-cost")
  @Permissions("purchasing.purchase-orders:read")
  supplierItemCost(@Query() query: Record<string, string>) {
    return this.purchasingService.getSupplierItemCost(
      query.supplierId,
      query.itemId,
      query.supplierItemId,
    );
  }

  @Post("purchase-orders")
  @Permissions("purchasing.purchase-orders:create")
  @LocationAccess({ source: "body", key: "locationId" })
  createPurchaseOrder(
    @Body() body: CreatePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.purchasingService.createPurchaseOrder(body, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Patch("purchase-orders/:id")
  @Permissions("purchasing.purchase-orders:create")
  updatePurchaseOrder(
    @Param("id") id: string,
    @Body() body: UpdatePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.purchasingService.updatePurchaseOrder(id, body, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Get("purchase-orders/:id")
  @Permissions("purchasing.purchase-orders:read")
  getPurchaseOrder(@Param("id") id: string) {
    return this.purchasingService.list("purchase-orders.detail", { id });
  }

  @Post("purchase-orders/:id/submit")
  @Permissions("purchasing.purchase-orders:create")
  submitPurchaseOrder(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.purchasingService.submitPurchaseOrder(id, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Post("purchase-orders/:id/approve")
  @Permissions("purchasing.purchase-orders:approve")
  approvePurchaseOrder(
    @Param("id") id: string,
    @Body() body: ApprovePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.purchasingService.approvePurchaseOrder(id, body, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Post("purchase-orders/:id/reject")
  @Permissions("purchasing.purchase-orders:approve")
  rejectPurchaseOrder(
    @Param("id") id: string,
    @Body() body: RejectPurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.purchasingService.rejectPurchaseOrder(id, body, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Post("purchase-orders/:id/close-balance")
  @Permissions("purchasing.purchase-orders:approve")
  closePurchaseOrderBalance(
    @Param("id") id: string,
    @Body() body: ClosePurchaseOrderBalanceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.purchasingService.closePurchaseOrderBalance(id, body, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Post("receivings")
  @Permissions("purchasing.receivings:create")
  @LocationAccess({ source: "body", key: "locationId" })
  receiveGoods(
    @Body() body: CreateReceivingDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.purchasingService.createReceiving(body, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Get("receivings/:id")
  @Permissions("purchasing.receivings:read")
  getReceiving(@Param("id") id: string) {
    return this.purchasingService.list("receivings.detail", { id });
  }
}
