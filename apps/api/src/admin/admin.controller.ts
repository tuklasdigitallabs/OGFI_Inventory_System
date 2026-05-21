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
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { AdminService } from "./admin.service";
import {
  CreateAdminUserDto,
  CreateSyncDeviceDto,
  ResetOfflinePinDto,
  UpdateAdminUserDto,
  UpdateRoleDto,
  UpdateSyncDeviceDto,
} from "./dto/admin.dto";

@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("users")
  @Permissions("admin.users:read")
  listUsers(@Query() query: Record<string, string>) {
    return this.adminService.list("users", query);
  }

  @Post("users")
  @Permissions("admin.users:create")
  createUser(
    @Body() body: CreateAdminUserDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.adminService.createUser(
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Patch("users/:id")
  @Permissions("admin.users:update")
  updateUser(
    @Param("id") id: string,
    @Body() body: UpdateAdminUserDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.adminService.updateUser(
      id,
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Post("users/:id/deactivate")
  @Permissions("admin.users:deactivate")
  deactivateUser(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.adminService.deactivateUser(
      id,
      user,
      this.auditMetadata(request),
    );
  }

  @Post("users/:id/reset-password")
  @Permissions("admin.users:update")
  resetUserPassword(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.adminService.resetUserPassword(
      id,
      user,
      this.auditMetadata(request),
    );
  }

  @Post("users/:id/unrestrict")
  @Permissions("admin.users:update")
  unrestrictUser(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.adminService.unrestrictUser(
      id,
      user,
      this.auditMetadata(request),
    );
  }

  @Post("users/:id/unlock")
  @Permissions("admin.users:update")
  unlockUser(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.adminService.unlockUser(
      id,
      user,
      this.auditMetadata(request),
    );
  }

  @Get("roles")
  @Permissions("admin.roles:read")
  listRoles() {
    return this.adminService.list("roles");
  }

  @Post("roles")
  @Permissions("admin.roles:update")
  createRole(@Body() body: unknown) {
    return this.adminService.createRole(body);
  }

  @Patch("roles/:id")
  @Permissions("admin.roles:update")
  updateRole(
    @Param("id") id: string,
    @Body() body: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.adminService.updateRole(
      id,
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Get("permissions")
  @Permissions("admin.roles:read")
  listPermissions() {
    return this.adminService.list("permissions");
  }

  @Get("audit-logs")
  @Permissions("admin.audit:read")
  searchAuditLogs(@Query() query: Record<string, string>) {
    return this.adminService.list("audit-logs", query);
  }

  @Get("offline-pin")
  @Permissions("admin.users:read")
  offlinePinPolicy(@CurrentUser() user: AuthenticatedUser) {
    return this.adminService.offlinePinPolicy(user);
  }

  @Post("offline-pin/reset")
  @Permissions("admin.users:update")
  resetOfflinePin(
    @Body() body: ResetOfflinePinDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.adminService.resetOfflinePin(
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Get("sync-devices")
  @Permissions("admin.devices:read")
  listSyncDevices(@Query() query: Record<string, string>) {
    return this.adminService.list("sync-devices", query);
  }

  @Post("sync-devices")
  @Permissions("admin.devices:create")
  createSyncDevice(
    @Body() body: CreateSyncDeviceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.adminService.createSyncDevice(
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Patch("sync-devices/:id")
  @Permissions("admin.devices:update")
  updateSyncDevice(
    @Param("id") id: string,
    @Body() body: UpdateSyncDeviceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.adminService.updateSyncDevice(
      id,
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Post("sync-devices/:id/deactivate")
  @Permissions("admin.devices:deactivate")
  deactivateSyncDevice(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.adminService.deactivateSyncDevice(
      id,
      user,
      this.auditMetadata(request),
    );
  }

  private auditMetadata(request: Request) {
    return {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    };
  }
}
