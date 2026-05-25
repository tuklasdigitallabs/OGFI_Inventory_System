import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma, User } from "@prisma/client";
import { createChallenge, verifySolution } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  ChangePasswordDto,
  LoginDto,
  OfflinePinDto,
  RefreshTokenDto,
} from "./dto/login.dto";
import {
  maxDailyRestrictions,
  maxFailedLoginAttempts,
  restrictionWindowMs,
} from "./password-policy";
import { AuthenticatedUser } from "./types";

interface RequestAuditMetadata {
  ipAddress?: string;
  userAgent?: string;
}

const offlinePinSettingKey = "offline_pin_policy";
const refreshTokenBytes = 48;

type OfflinePinSettingValue = {
  passwordHash: string;
  updatedAt: string;
  updatedById: string;
  version: 1;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly auditService: AuditService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async createAltchaChallenge() {
    const hmacSignatureSecret = this.altchaSecret();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    return createChallenge({
      algorithm: "PBKDF2/SHA-256",
      cost: Number(this.config.get<string>("ALTCHA_COST") ?? 8000),
      deriveKey,
      expiresAt,
      hmacSignatureSecret,
      keyPrefixLength: Number(
        this.config.get<string>("ALTCHA_KEY_PREFIX_LENGTH") ?? 2,
      ),
    });
  }

  async login(dto: LoginDto, metadata: RequestAuditMetadata = {}) {
    const identifier = dto.identifier ?? dto.email ?? dto.username;

    if (!identifier) {
      throw new BadRequestException("Provide identifier, email, or username.");
    }

    await this.verifyAltchaPayload(dto.altcha);

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        locationAccess: true,
      },
    });

    if (!user) {
      await this.auditService.record("auth", "login.failed", {
        after: { identifier },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });
      throw new UnauthorizedException("Invalid credentials.");
    }

    this.assertAccountCanLogin(user);

    if (!(await bcrypt.compare(dto.password, user.passwordHash))) {
      await this.recordFailedLoginAttempt(user, metadata);
      throw new UnauthorizedException("Invalid credentials.");
    }

    const authenticatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lastFailedLoginAt: null,
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        locationAccess: true,
      },
    });

    await this.auditService.record("auth", "login.succeeded", {
      userId: user.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    const session = await this.createSession(user.id, metadata);
    const accessToken = await this.signAccessToken(user.id, session.id);

    return {
      accessToken,
      refreshToken: session.refreshToken,
      tokenType: "Bearer",
      expiresIn: this.config.get<string>("JWT_ACCESS_TTL") ?? "15m",
      user: this.toAuthenticatedUser(authenticatedUser),
    };
  }

  private assertAccountCanLogin(user: User) {
    if (!user.active) {
      throw new ForbiddenException("Account is inactive.");
    }

    if (user.lockedAt) {
      throw new HttpException(
        "Account is locked. Ask an admin to unlock it.",
        423,
      );
    }

    if (user.restrictedAt) {
      throw new HttpException(
        "Account is restricted. Ask an admin to unrestrict it.",
        423,
      );
    }
  }

  private async recordFailedLoginAttempt(
    user: User,
    metadata: RequestAuditMetadata,
  ) {
    const failedLoginCount = user.failedLoginCount + 1;
    const shouldRestrict = failedLoginCount >= maxFailedLoginAttempts;
    const now = new Date();
    const windowStart = user.restrictionWindowStart;
    const isSameWindow =
      windowStart &&
      now.getTime() - windowStart.getTime() <= restrictionWindowMs;
    const restrictionCount = shouldRestrict
      ? isSameWindow
        ? user.restrictionCount + 1
        : 1
      : user.restrictionCount;
    const shouldLock =
      shouldRestrict && restrictionCount >= maxDailyRestrictions;

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: shouldRestrict ? 0 : failedLoginCount,
        lastFailedLoginAt: now,
        restrictedAt: shouldRestrict ? now : undefined,
        restrictedReason: shouldRestrict
          ? `${maxFailedLoginAttempts} incorrect login attempts.`
          : undefined,
        restrictionCount,
        restrictionWindowStart: shouldRestrict
          ? isSameWindow
            ? windowStart
            : now
          : user.restrictionWindowStart,
        lockedAt: shouldLock ? now : undefined,
        lockReason: shouldLock
          ? `${maxDailyRestrictions} account restrictions within 24 hours.`
          : undefined,
      },
    });

    if (updated.restrictedAt || updated.lockedAt) {
      await this.revokeUserSessions(user.id);
    }

    await this.auditService.record("auth", "login.failed", {
      userId: user.id,
      after: {
        failedLoginCount: updated.failedLoginCount,
        lockedAt: updated.lockedAt,
        restrictedAt: updated.restrictedAt,
        restrictionCount: updated.restrictionCount,
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  }

  private altchaSecret() {
    const secret = this.config.get<string>("ALTCHA_HMAC_SECRET");

    if (secret) {
      return secret;
    }

    if (this.config.get<string>("NODE_ENV") === "production") {
      throw new Error("ALTCHA_HMAC_SECRET is required in production.");
    }

    return "dev-altcha-secret-change-me";
  }

  private jwtSecret() {
    const secret = this.config.get<string>("JWT_ACCESS_SECRET");

    if (secret) {
      return secret;
    }

    if (this.config.get<string>("NODE_ENV") === "production") {
      throw new Error("JWT_ACCESS_SECRET is required in production.");
    }

    return "replace-with-access-secret";
  }

  currentUser(user: AuthenticatedUser) {
    return user;
  }

  async changePassword(
    dto: ChangePasswordDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!existing?.active) {
      throw new UnauthorizedException("Invalid or inactive user.");
    }

    if (!(await bcrypt.compare(dto.currentPassword, existing.passwordHash))) {
      throw new UnauthorizedException("Current password is incorrect.");
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        mustChangePassword: false,
        passwordHash: await bcrypt.hash(dto.newPassword, 12),
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        locationAccess: true,
      },
    });

    await this.auditService.record("auth", "password.change", {
      userId: user.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    await this.revokeUserSessions(user.id, user.sessionId);

    return this.toAuthenticatedUser(updated);
  }

  private async verifyAltchaPayload(payload: string) {
    let decoded: {
      challenge: Parameters<typeof verifySolution>[0]["challenge"];
      solution: Parameters<typeof verifySolution>[0]["solution"];
    };

    try {
      decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    } catch {
      throw new UnauthorizedException("CAPTCHA verification failed.");
    }

    const result = await verifySolution({
      hmacSignatureSecret: this.altchaSecret(),
      deriveKey,
      ...decoded,
    });

    if (!result.verified) {
      throw new UnauthorizedException("CAPTCHA verification failed.");
    }
  }

  async offlinePinStatus() {
    const setting = await this.getOfflinePinSetting();

    return {
      configured: Boolean(setting),
      updatedAt: setting?.updatedAt.toISOString() ?? null,
    };
  }

  async verifyOfflinePin(
    dto: OfflinePinDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    const setting = await this.getOfflinePinSetting();

    if (!setting) {
      throw new BadRequestException("Offline PIN is not configured.");
    }

    const valid = await bcrypt.compare(dto.pin, setting.value.passwordHash);

    await this.auditService.record("auth", "offline-pin.verify", {
      userId: user.id,
      after: { verified: valid },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    if (!valid) {
      throw new UnauthorizedException("Invalid offline PIN.");
    }

    return {
      configured: true,
      updatedAt: setting.updatedAt.toISOString(),
    };
  }

  async refresh(dto: RefreshTokenDto, metadata: RequestAuditMetadata = {}) {
    if (!dto.refreshToken) {
      throw new UnauthorizedException("Session expired. Sign in again.");
    }

    const tokenHash = this.hashRefreshToken(dto.refreshToken);
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: {
        user: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
            locationAccess: true,
          },
        },
      },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException("Session expired. Sign in again.");
    }

    this.assertAccountCanLogin(session.user);

    const refreshToken = this.generateRefreshToken();
    const updated = await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: this.refreshExpiresAt(),
        lastUsedAt: new Date(),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });
    const accessToken = await this.signAccessToken(session.userId, updated.id);

    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: this.config.get<string>("JWT_ACCESS_TTL") ?? "15m",
      user: this.toAuthenticatedUser(session.user),
    };
  }

  async logout(user: AuthenticatedUser, metadata: RequestAuditMetadata = {}) {
    if (user.sessionId) {
      await this.prisma.userSession.updateMany({
        where: { id: user.sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.auditService.record("auth", "logout", {
      userId: user.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return {
      status: "logged_out",
    };
  }

  private async createSession(
    userId: string,
    metadata: RequestAuditMetadata = {},
  ) {
    const refreshToken = this.generateRefreshToken();
    const session = await this.prisma.userSession.create({
      data: {
        userId,
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: this.refreshExpiresAt(),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });

    return { id: session.id, refreshToken };
  }

  private generateRefreshToken() {
    return randomBytes(refreshTokenBytes).toString("base64url");
  }

  private hashRefreshToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private refreshExpiresAt() {
    const ttlDays = Number(this.config.get<string>("JWT_REFRESH_TTL_DAYS") ?? 7);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);
    return expiresAt;
  }

  private signAccessToken(userId: string, sessionId: string) {
    return this.jwtService.signAsync(
      { sid: sessionId, sub: userId },
      {
        expiresIn: this.config.get<string>("JWT_ACCESS_TTL") ?? "15m",
        secret: this.jwtSecret(),
      },
    );
  }

  private revokeUserSessions(userId: string, exceptSessionId?: string) {
    return this.prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        id: exceptSessionId ? { not: exceptSessionId } : undefined,
      },
      data: { revokedAt: new Date() },
    });
  }

  private toAuthenticatedUser(
    user: User & {
      role: {
        id: string;
        code: AuthenticatedUser["role"]["code"];
        name: string;
        permissions: Array<{
          permission: {
            module: string;
            action: string;
          };
        }>;
      };
      locationAccess: Array<{
        locationId: string;
      }>;
    },
  ): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      mustChangePassword: user.mustChangePassword,
      role: {
        id: user.role.id,
        code: user.role.code,
        name: user.role.name,
      },
      permissions: user.role.permissions.map(
        ({ permission }) => `${permission.module}:${permission.action}`,
      ),
      locationIds: user.locationAccess.map(({ locationId }) => locationId),
      sessionId: "sessionId" in user ? String(user.sessionId) : undefined,
    };
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
}
