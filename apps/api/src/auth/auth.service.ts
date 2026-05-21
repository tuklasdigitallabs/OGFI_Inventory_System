import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma, User } from "@prisma/client";
import { createChallenge, verifySolution } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import * as bcrypt from "bcrypt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto, OfflinePinDto } from "./dto/login.dto";
import { AuthenticatedUser } from "./types";

interface RequestAuditMetadata {
  ipAddress?: string;
  userAgent?: string;
}

type LoginAttempt = {
  count: number;
  lockedUntil: number;
  windowStartedAt: number;
};

const loginAttempts = new Map<string, LoginAttempt>();
const loginWindowMs = 15 * 60 * 1000;
const loginMaxAttempts = 5;
const lockoutMs = 15 * 60 * 1000;
const offlinePinSettingKey = "offline_pin_policy";

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

    this.assertCanAttemptLogin(identifier, metadata);
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

    if (
      !user?.active ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    ) {
      this.recordFailedLoginAttempt(identifier, metadata);
      await this.auditService.record("auth", "login.failed", {
        after: { identifier },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });
      throw new UnauthorizedException("Invalid credentials.");
    }

    this.clearLoginAttempts(identifier, metadata);
    await this.auditService.record("auth", "login.succeeded", {
      userId: user.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id },
      {
        expiresIn: this.config.get<string>("JWT_ACCESS_TTL") ?? "15m",
        secret: this.jwtSecret(),
      },
    );

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: this.config.get<string>("JWT_ACCESS_TTL") ?? "15m",
      user: this.toAuthenticatedUser(user),
    };
  }

  private assertCanAttemptLogin(
    identifier: string,
    metadata: RequestAuditMetadata,
  ) {
    const key = this.loginAttemptKey(identifier, metadata);
    const attempt = loginAttempts.get(key);

    if (!attempt) {
      return;
    }

    if (attempt.lockedUntil > Date.now()) {
      throw new HttpException(
        "Too many failed login attempts. Try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (Date.now() - attempt.windowStartedAt > loginWindowMs) {
      loginAttempts.delete(key);
    }
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

  private recordFailedLoginAttempt(
    identifier: string,
    metadata: RequestAuditMetadata,
  ) {
    const key = this.loginAttemptKey(identifier, metadata);
    const existing = loginAttempts.get(key);
    const attempt =
      existing && Date.now() - existing.windowStartedAt <= loginWindowMs
        ? existing
        : { count: 0, lockedUntil: 0, windowStartedAt: Date.now() };

    attempt.count += 1;

    if (attempt.count >= loginMaxAttempts) {
      attempt.lockedUntil = Date.now() + lockoutMs;
    }

    loginAttempts.set(key, attempt);
  }

  private clearLoginAttempts(
    identifier: string,
    metadata: RequestAuditMetadata,
  ) {
    loginAttempts.delete(this.loginAttemptKey(identifier, metadata));
  }

  private loginAttemptKey(identifier: string, metadata: RequestAuditMetadata) {
    return `${metadata.ipAddress ?? "unknown"}:${identifier.toLowerCase()}`;
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

  refresh() {
    return {
      status: "deferred",
      next: "Refresh token rotation is deferred until persistent refresh token storage is added.",
    };
  }

  async logout(user: AuthenticatedUser, metadata: RequestAuditMetadata = {}) {
    await this.auditService.record("auth", "logout", {
      userId: user.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return {
      status: "logged_out",
    };
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
      role: {
        id: user.role.id,
        code: user.role.code,
        name: user.role.name,
      },
      permissions: user.role.permissions.map(
        ({ permission }) => `${permission.module}:${permission.action}`,
      ),
      locationIds: user.locationAccess.map(({ locationId }) => locationId),
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
