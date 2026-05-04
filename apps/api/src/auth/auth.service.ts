import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from './types';

interface RequestAuditMetadata {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly auditService: AuditService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async login(dto: LoginDto, metadata: RequestAuditMetadata = {}) {
    const identifier = dto.identifier ?? dto.email ?? dto.username;

    if (!identifier) {
      throw new BadRequestException('Provide identifier, email, or username.');
    }

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

    if (!user?.active || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      await this.auditService.record('auth', 'login.failed', {
        after: { identifier },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials.');
    }

    await this.auditService.record('auth', 'login.succeeded', {
      userId: user.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id },
      {
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
        secret: this.config.get<string>('JWT_ACCESS_SECRET') ?? 'replace-with-access-secret',
      },
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
      user: this.toAuthenticatedUser(user),
    };
  }

  currentUser(user: AuthenticatedUser) {
    return user;
  }

  refresh() {
    return {
      status: 'deferred',
      next: 'Refresh token rotation is deferred until persistent refresh token storage is added.',
    };
  }

  async logout(user: AuthenticatedUser, metadata: RequestAuditMetadata = {}) {
    await this.auditService.record('auth', 'logout', {
      userId: user.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return {
      status: 'logged_out',
    };
  }

  private toAuthenticatedUser(
    user: User & {
      role: {
        id: string;
        code: AuthenticatedUser['role']['code'];
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
      permissions: user.role.permissions.map(({ permission }) => `${permission.module}:${permission.action}`),
      locationIds: user.locationAccess.map(({ locationId }) => locationId),
    };
  }
}
