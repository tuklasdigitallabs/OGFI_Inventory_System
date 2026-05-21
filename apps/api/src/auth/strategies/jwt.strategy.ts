import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../prisma/prisma.service";
import { AccessTokenPayload, AuthenticatedUser } from "../types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret(config),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
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

    if (!user?.active) {
      throw new UnauthorizedException("Invalid or inactive user.");
    }

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
}

function jwtSecret(config: ConfigService) {
  const secret = config.get<string>("JWT_ACCESS_SECRET");

  if (secret) {
    return secret;
  }

  if (config.get<string>("NODE_ENV") === "production") {
    throw new Error("JWT_ACCESS_SECRET is required in production.");
  }

  return "replace-with-access-secret";
}
