import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, RoleCode, User } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { AuditService } from "../audit/audit.service";
import { defaultTemporaryPassword } from "../auth/password-policy";
import { AuthenticatedUser } from "../auth/types";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateAdminUserDto,
  CreateSyncDeviceDto,
  ResetOfflinePinDto,
  UpdateAdminUserDto,
  UpdateRoleDto,
  UpdateSyncDeviceDto,
} from "./dto/admin.dto";

interface RequestAuditMetadata {
  ipAddress?: string;
  userAgent?: string;
}

type UserWithAccess = User & {
  role: { id: string; code: string; name: string };
  locationAccess: Array<{
    location: { id: string; code: string; name: string };
  }>;
};

const offlinePinSettingKey = "offline_pin_policy";

type OfflinePinSettingValue = {
  passwordHash: string;
  updatedAt: string;
  updatedById: string;
  version: 1;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async list(resource: string, query: Record<string, string> = {}) {
    if (resource === "users") {
      return this.listUsers(query);
    }

    if (resource === "roles") {
      return this.listRoles();
    }

    if (resource === "permissions") {
      return this.listPermissions();
    }

    if (resource === "audit-logs") {
      return this.listAuditLogs(query);
    }

    if (resource === "sync-devices") {
      return this.listSyncDevices(query);
    }

    throw new NotFoundException("Admin resource not found.");
  }

  async createUser(
    dto: CreateAdminUserDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    const roleId = await this.resolveRoleId(dto.roleId);
    await this.validateLocations(dto.locationIds);

    try {
      const created = await this.prisma.user.create({
        data: {
          email: dto.email.trim().toLowerCase(),
          username: dto.username.trim(),
          fullName: dto.fullName.trim(),
          passwordHash: await bcrypt.hash(defaultTemporaryPassword, 12),
          mustChangePassword: true,
          roleId,
          active: dto.active ?? true,
          locationAccess: {
            create: dto.locationIds.map((locationId) => ({ locationId })),
          },
        },
        include: this.userInclude(),
      });

      await this.auditService.record("admin", "users.create", {
        userId: user.id,
        entityType: "User",
        entityId: created.id,
        after: this.toAuditUser(created),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });

      return this.toUserResponse(created);
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException("Email or username already exists.");
      }

      throw error;
    }
  }

  async updateUser(
    id: string,
    dto: UpdateAdminUserDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    const before = await this.findUser(id);
    const roleId = dto.roleId
      ? await this.resolveRoleId(dto.roleId)
      : undefined;

    if (dto.locationIds) {
      await this.validateLocations(dto.locationIds);
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (dto.locationIds) {
          await tx.userLocationAccess.deleteMany({ where: { userId: id } });
          await tx.userLocationAccess.createMany({
            data: dto.locationIds.map((locationId) => ({
              userId: id,
              locationId,
            })),
          });
        }

        return tx.user.update({
          where: { id },
          data: {
            email: dto.email?.trim().toLowerCase(),
            username: dto.username?.trim(),
            fullName: dto.fullName?.trim(),
            roleId,
            active: dto.active,
            passwordHash: dto.password
              ? await bcrypt.hash(dto.password, 12)
              : undefined,
            mustChangePassword: dto.password ? true : undefined,
          },
          include: this.userInclude(),
        });
      });

      await this.auditService.record("admin", "users.update", {
        userId: user.id,
        entityType: "User",
        entityId: updated.id,
        before: this.toAuditUser(before),
        after: this.toAuditUser(updated),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });

      return this.toUserResponse(updated);
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException("Email or username already exists.");
      }

      throw error;
    }
  }

  async deactivateUser(
    id: string,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    if (id === user.id) {
      throw new BadRequestException("You cannot deactivate your own account.");
    }

    const before = await this.findUser(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { active: false },
      include: this.userInclude(),
    });

    await this.auditService.record("admin", "users.deactivate", {
      userId: user.id,
      entityType: "User",
      entityId: updated.id,
      before: this.toAuditUser(before),
      after: this.toAuditUser(updated),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return this.toUserResponse(updated);
  }

  async resetUserPassword(
    id: string,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    const before = await this.findUser(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(defaultTemporaryPassword, 12),
        mustChangePassword: true,
        failedLoginCount: 0,
        lastFailedLoginAt: null,
      },
      include: this.userInclude(),
    });

    await this.auditService.record("admin", "users.reset-password", {
      userId: user.id,
      entityType: "User",
      entityId: updated.id,
      before: this.toAuditUser(before),
      after: this.toAuditUser(updated),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return this.toUserResponse(updated);
  }

  async unrestrictUser(
    id: string,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    const before = await this.findUser(id);

    if (before.lockedAt) {
      throw new BadRequestException(
        "Unlock this account before unrestricting it.",
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        failedLoginCount: 0,
        lastFailedLoginAt: null,
        restrictedAt: null,
        restrictedReason: null,
      },
      include: this.userInclude(),
    });

    await this.auditService.record("admin", "users.unrestrict", {
      userId: user.id,
      entityType: "User",
      entityId: updated.id,
      before: this.toAuditUser(before),
      after: this.toAuditUser(updated),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return this.toUserResponse(updated);
  }

  async unlockUser(
    id: string,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    const before = await this.findUser(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        failedLoginCount: 0,
        lastFailedLoginAt: null,
        restrictedAt: null,
        restrictedReason: null,
        restrictionCount: 0,
        restrictionWindowStart: null,
        lockedAt: null,
        lockReason: null,
      },
      include: this.userInclude(),
    });

    await this.auditService.record("admin", "users.unlock", {
      userId: user.id,
      entityType: "User",
      entityId: updated.id,
      before: this.toAuditUser(before),
      after: this.toAuditUser(updated),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return this.toUserResponse(updated);
  }

  async createSyncDevice(
    dto: CreateSyncDeviceDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    if (dto.locationId) {
      await this.validateLocations([dto.locationId]);
    }

    try {
      const created = await this.prisma.syncDevice.create({
        data: {
          active: dto.active ?? true,
          deviceCode: dto.deviceCode.trim(),
          locationId: dto.locationId,
          name: dto.name.trim(),
          type: dto.type?.trim(),
        },
        include: { location: true },
      });

      await this.auditService.record("admin", "sync-devices.create", {
        userId: user.id,
        entityType: "SyncDevice",
        entityId: created.id,
        after: this.toSyncDeviceResponse(created) as Prisma.InputJsonValue,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });

      return this.toSyncDeviceResponse(created);
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException("Device code already exists.");
      }

      throw error;
    }
  }

  async updateSyncDevice(
    id: string,
    dto: UpdateSyncDeviceDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    const before = await this.findSyncDevice(id);

    if (dto.locationId) {
      await this.validateLocations([dto.locationId]);
    }

    try {
      const updated = await this.prisma.syncDevice.update({
        where: { id },
        data: {
          active: dto.active,
          deviceCode: dto.deviceCode?.trim(),
          locationId: dto.locationId,
          name: dto.name?.trim(),
          type: dto.type?.trim(),
        },
        include: { location: true },
      });

      await this.auditService.record("admin", "sync-devices.update", {
        userId: user.id,
        entityType: "SyncDevice",
        entityId: updated.id,
        before: this.toSyncDeviceResponse(before) as Prisma.InputJsonValue,
        after: this.toSyncDeviceResponse(updated) as Prisma.InputJsonValue,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });

      return this.toSyncDeviceResponse(updated);
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException("Device code already exists.");
      }

      throw error;
    }
  }

  async deactivateSyncDevice(
    id: string,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    const before = await this.findSyncDevice(id);
    const updated = await this.prisma.syncDevice.update({
      where: { id },
      data: { active: false },
      include: { location: true },
    });

    await this.auditService.record("admin", "sync-devices.deactivate", {
      userId: user.id,
      entityType: "SyncDevice",
      entityId: updated.id,
      before: this.toSyncDeviceResponse(before) as Prisma.InputJsonValue,
      after: this.toSyncDeviceResponse(updated) as Prisma.InputJsonValue,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return this.toSyncDeviceResponse(updated);
  }

  createRole(_payload: unknown) {
    throw new BadRequestException(
      "Role creation is fixed by the current role enum. Update an existing role's permissions instead.",
    );
  }

  async offlinePinPolicy(user: AuthenticatedUser) {
    this.assertAdministrator(user);
    const setting = await this.getOfflinePinSetting();

    if (!setting) {
      return {
        configured: false,
        updatedAt: null,
        updatedById: null,
        updatedByName: null,
      };
    }

    const updatedBy = await this.prisma.user.findUnique({
      where: { id: setting.value.updatedById },
      select: { fullName: true, username: true },
    });

    return {
      configured: true,
      updatedAt: setting.updatedAt.toISOString(),
      updatedById: setting.value.updatedById,
      updatedByName: updatedBy?.fullName ?? updatedBy?.username ?? null,
    };
  }

  async resetOfflinePin(
    dto: ResetOfflinePinDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    this.assertAdministrator(user);
    const before = await this.offlinePinPolicy(user);
    const updatedAt = new Date().toISOString();
    const value = JSON.stringify({
      passwordHash: await bcrypt.hash(dto.pin, 12),
      updatedAt,
      updatedById: user.id,
      version: 1,
    } satisfies OfflinePinSettingValue);

    await this.prisma.$executeRaw`
      INSERT INTO "system_settings" ("id", "key", "value", "createdAt", "updatedAt")
      VALUES (${randomUUID()}::uuid, ${offlinePinSettingKey}, ${value}::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("key") DO UPDATE SET
        "value" = ${value}::jsonb,
        "updatedAt" = CURRENT_TIMESTAMP
    `;

    const after = await this.offlinePinPolicy(user);

    await this.auditService.record("admin", "offline-pin.reset", {
      userId: user.id,
      entityType: "SystemSetting",
      before: before as Prisma.InputJsonValue,
      after: after as Prisma.InputJsonValue,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return after;
  }

  async updateRole(
    id: string,
    dto: UpdateRoleDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    const before = await this.prisma.role.findUnique({
      where: { id },
      include: this.roleInclude(),
    });

    if (!before) {
      throw new NotFoundException("Role not found.");
    }

    if (dto.permissionIds) {
      await this.validatePermissions(dto.permissionIds);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({
            roleId: id,
            permissionId,
          })),
        });
      }

      return tx.role.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description?.trim(),
        },
        include: this.roleInclude(),
      });
    });

    await this.auditService.record("admin", "roles.update", {
      userId: user.id,
      entityType: "Role",
      entityId: updated.id,
      before: this.toRoleResponse(before),
      after: this.toRoleResponse(updated),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return this.toRoleResponse(updated);
  }

  private async listUsers(query: Record<string, string>) {
    const search = query.search?.trim();
    const active =
      query.active === "true"
        ? true
        : query.active === "false"
          ? false
          : undefined;

    const users = await this.prisma.user.findMany({
      where: {
        active,
        roleId: query.roleId || undefined,
        OR: search
          ? [
              { email: { contains: search, mode: "insensitive" } },
              { username: { contains: search, mode: "insensitive" } },
              { fullName: { contains: search, mode: "insensitive" } },
            ]
          : undefined,
      },
      include: this.userInclude(),
      orderBy: { fullName: "asc" },
      take: this.parseTake(query.take),
    });

    return {
      resource: "admin.users",
      data: users.map((user) => this.toUserResponse(user)),
    };
  }

  private async listRoles() {
    const roles = await this.prisma.role.findMany({
      include: this.roleInclude(),
      orderBy: { code: "asc" },
    });

    return {
      resource: "admin.roles",
      data: roles.map((role) => this.toRoleResponse(role)),
    };
  }

  private async listPermissions() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { action: "asc" }],
    });

    return {
      resource: "admin.permissions",
      data: permissions.map((permission) => ({
        ...permission,
        key: `${permission.module}:${permission.action}`,
      })),
    };
  }

  private async listAuditLogs(query: Record<string, string>) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        module: query.module || undefined,
        action: query.action || undefined,
        userId: query.userId || undefined,
      },
      include: {
        user: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
      take: this.parseTake(query.take),
    });

    return {
      resource: "admin.audit-logs",
      data: logs.map((log) => ({
        id: log.id,
        module: log.module,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        userId: log.userId,
        userName: log.user?.fullName ?? log.user?.username ?? "System",
        locationId: log.locationId,
        reasonCodeId: log.reasonCodeId,
        before: log.before,
        after: log.after,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }

  private async listSyncDevices(query: Record<string, string>) {
    const active =
      query.active === "true"
        ? true
        : query.active === "false"
          ? false
          : undefined;
    const search = query.search?.trim();

    const devices = await this.prisma.syncDevice.findMany({
      where: {
        active,
        locationId: query.locationId || undefined,
        OR: search
          ? [
              { deviceCode: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { type: { contains: search, mode: "insensitive" } },
            ]
          : undefined,
      },
      include: { location: true },
      orderBy: [{ active: "desc" }, { deviceCode: "asc" }],
      take: this.parseTake(query.take),
    });

    return {
      resource: "admin.sync-devices",
      data: devices.map((device) => this.toSyncDeviceResponse(device)),
    };
  }

  private async findUser(id: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: this.userInclude(),
    });

    if (!existing) {
      throw new NotFoundException("User not found.");
    }

    return existing;
  }

  private async findSyncDevice(id: string) {
    const existing = await this.prisma.syncDevice.findUnique({
      where: { id },
      include: { location: true },
    });

    if (!existing) {
      throw new NotFoundException("Sync device not found.");
    }

    return existing;
  }

  private isUniqueConflict(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  private parseTake(value?: string) {
    const take = Number(value);

    if (!Number.isFinite(take)) {
      return 200;
    }

    return Math.max(1, Math.min(500, Math.trunc(take)));
  }

  private roleInclude() {
    return {
      permissions: {
        include: { permission: true },
      },
      _count: {
        select: { users: true },
      },
    } satisfies Prisma.RoleInclude;
  }

  private toAuditUser(user: UserWithAccess) {
    const response = this.toUserResponse(user);

    return response as Prisma.InputJsonValue;
  }

  private toRoleResponse(role: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    permissions: Array<{
      permission: { id: string; module: string; action: string };
    }>;
    _count?: { users: number };
  }) {
    const permissionIds = role.permissions.map(
      ({ permission }) => permission.id,
    );
    const permissions = role.permissions
      .map(({ permission }) => `${permission.module}:${permission.action}`)
      .sort();

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      permissionIds,
      permissions,
      userCount: role._count?.users ?? 0,
    };
  }

  private toUserResponse(user: UserWithAccess) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      active: user.active,
      mustChangePassword: user.mustChangePassword,
      failedLoginCount: user.failedLoginCount,
      restrictedAt: user.restrictedAt?.toISOString() ?? null,
      restrictedReason: user.restrictedReason,
      restrictionCount: this.currentRestrictionCount(user),
      restrictionWindowStart: user.restrictionWindowStart?.toISOString() ?? null,
      lockedAt: user.lockedAt?.toISOString() ?? null,
      lockReason: user.lockReason,
      accountStatus: this.accountStatus(user),
      roleId: user.roleId,
      roleCode: user.role.code,
      roleName: user.role.name,
      locationIds: user.locationAccess.map(({ location }) => location.id),
      locations: user.locationAccess.map(({ location }) => ({
        id: location.id,
        code: location.code,
        name: location.name,
      })),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private accountStatus(user: UserWithAccess) {
    if (!user.active) {
      return "Inactive";
    }

    if (user.lockedAt) {
      return "Locked";
    }

    if (user.restrictedAt) {
      return "Restricted";
    }

    if (user.mustChangePassword) {
      return "Temporary Password";
    }

    return "Active";
  }

  private currentRestrictionCount(user: UserWithAccess) {
    if (
      !user.restrictionWindowStart ||
      Date.now() - user.restrictionWindowStart.getTime() > 24 * 60 * 60 * 1000
    ) {
      return 0;
    }

    return user.restrictionCount;
  }

  private toSyncDeviceResponse(device: {
    id: string;
    deviceCode: string;
    name: string;
    type: string | null;
    locationId: string | null;
    active: boolean;
    lastSeenAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    location: { id: string; code: string; name: string } | null;
  }) {
    return {
      id: device.id,
      deviceCode: device.deviceCode,
      name: device.name,
      type: device.type,
      locationId: device.locationId,
      location: device.location
        ? {
            id: device.location.id,
            code: device.location.code,
            name: device.location.name,
          }
        : null,
      active: device.active,
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
    };
  }

  private async validateLocations(locationIds: string[]) {
    const locations = await this.prisma.location.findMany({
      where: { id: { in: locationIds }, active: true },
      select: { id: true },
    });

    if (locations.length !== new Set(locationIds).size) {
      throw new BadRequestException("One or more locations are invalid.");
    }
  }

  private async validatePermissions(permissionIds: string[]) {
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
      select: { id: true },
    });

    if (permissions.length !== new Set(permissionIds).size) {
      throw new BadRequestException("One or more permissions are invalid.");
    }
  }

  private async resolveRoleId(roleIdOrCode: string) {
    const roleId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      roleIdOrCode,
    )
      ? roleIdOrCode
      : undefined;
    const roleCode = Object.values(RoleCode).includes(roleIdOrCode as RoleCode)
      ? (roleIdOrCode as RoleCode)
      : undefined;
    const role = await this.prisma.role.findFirst({
      where: {
        OR: [
          ...(roleId ? [{ id: roleId }] : []),
          ...(roleCode ? [{ code: roleCode }] : []),
        ],
      },
      select: { id: true },
    });

    if (!role) {
      throw new BadRequestException("Role is invalid.");
    }

    return role.id;
  }

  private assertAdministrator(user: AuthenticatedUser) {
    if (user.role.code !== RoleCode.ADMIN) {
      throw new ForbiddenException("Administrator access is required.");
    }
  }

  private async getOfflinePinSetting() {
    const rows = await this.prisma.$queryRaw<
      Array<{ value: Prisma.JsonValue; updatedAt: Date }>
    >`
      SELECT "value", "updatedAt"
      FROM "system_settings"
      WHERE "key" = ${offlinePinSettingKey}
      LIMIT 1
    `;
    const setting = rows[0];

    if (!setting || !this.isOfflinePinSettingValue(setting.value)) {
      return null;
    }

    return {
      updatedAt: setting.updatedAt,
      value: setting.value,
    };
  }

  private isOfflinePinSettingValue(
    value: Prisma.JsonValue,
  ): value is OfflinePinSettingValue {
    return (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      typeof value.passwordHash === "string" &&
      typeof value.updatedAt === "string" &&
      typeof value.updatedById === "string" &&
      value.version === 1
    );
  }

  private userInclude() {
    return {
      role: true,
      locationAccess: {
        include: { location: true },
        orderBy: { location: { code: "asc" } },
      },
    } satisfies Prisma.UserInclude;
  }
}
