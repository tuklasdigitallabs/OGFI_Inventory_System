import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types";
import { LocationAccess } from "../rbac/decorators/location-access.decorator";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import {
  ApproveTransferDto,
  CreateTransferDto,
  DispatchTransferDto,
  ReceiveTransferDto,
  ResolveTransferVarianceDto,
} from "./dto/transfers.dto";
import { TransfersService } from "./transfers.service";

@Controller("transfers")
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  @Permissions("transfers:read")
  listTransfers(@Query() query: Record<string, string>) {
    return this.transfersService.list(query);
  }

  @Post()
  @Permissions("transfers:create")
  @LocationAccess(
    { source: "body", key: "sourceLocationId" },
    { source: "body", key: "targetLocationId" },
  )
  createTransfer(
    @Body() body: CreateTransferDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.transfersService.createTransfer(body, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Get(":id")
  @Permissions("transfers:read")
  getTransfer(@Param("id") id: string) {
    return this.transfersService.getTransfer(id);
  }

  @Post(":id/approve")
  @Permissions("transfers:approve")
  approveTransfer(
    @Param("id") id: string,
    @Body() body: ApproveTransferDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.transfersService.approveTransfer(id, body, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Post(":id/dispatch")
  @Permissions("transfers:dispatch")
  dispatchTransfer(
    @Param("id") id: string,
    @Body() body: DispatchTransferDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.transfersService.dispatchTransfer(id, body, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Post(":id/receive")
  @Permissions("transfers:receive")
  receiveTransfer(
    @Param("id") id: string,
    @Body() body: ReceiveTransferDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.transfersService.receiveTransfer(id, body, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Post(":id/resolve-variance")
  @Permissions("transfers:approve")
  resolveVariance(
    @Param("id") id: string,
    @Body() body: ResolveTransferVarianceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.transfersService.resolveVariance(id, body, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Get(":id/variance")
  @Permissions("transfers:read")
  getVariance(@Param("id") id: string) {
    return this.transfersService.getVariance(id);
  }
}
