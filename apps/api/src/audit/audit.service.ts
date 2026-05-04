import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    module: string,
    action: string,
    payload: {
      userId?: string;
      entityType?: string;
      entityId?: string;
      locationId?: string;
      reasonCodeId?: string;
      before?: Prisma.InputJsonValue;
      after?: Prisma.InputJsonValue;
      ipAddress?: string;
      userAgent?: string;
    } = {},
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId: payload.userId,
        module,
        action,
        entityType: payload.entityType,
        entityId: payload.entityId,
        locationId: payload.locationId,
        reasonCodeId: payload.reasonCodeId,
        before: payload.before,
        after: payload.after,
        ipAddress: payload.ipAddress,
        userAgent: payload.userAgent,
      },
    });
  }

  async recordPlaceholder(module: string, action: string, payload: unknown) {
    await this.record(module, action, {
      after: payload === undefined ? undefined : (payload as Prisma.InputJsonValue),
    });

    return {
      module,
      action,
      payload,
      status: 'audited',
    };
  }
}
