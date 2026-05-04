import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../../auth/types';
import {
  LOCATION_ACCESS_KEY,
  LocationAccessRequirement,
} from '../decorators/location-access.decorator';
import { RbacService } from '../rbac.service';

type RequestWithLocationParts = {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  user?: AuthenticatedUser;
};

@Injectable()
export class LocationAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requirements = this.reflector.getAllAndOverride<LocationAccessRequirement[]>(LOCATION_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requirements?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithLocationParts>();
    const user = request.user;
    const locationIds = requirements.flatMap((requirement) => this.extractLocationIds(request, requirement));

    if (!user || !this.rbacService.canAccessAllLocations(user.locationIds, locationIds)) {
      throw new ForbiddenException('Location access denied.');
    }

    return true;
  }

  private extractLocationIds(request: RequestWithLocationParts, requirement: LocationAccessRequirement): string[] {
    const rawValue = request[requirement.source]?.[requirement.key];

    if (!rawValue) {
      return [];
    }

    if (Array.isArray(rawValue)) {
      return rawValue.filter((value): value is string => typeof value === 'string' && value.length > 0);
    }

    if (typeof rawValue === 'string') {
      return [rawValue];
    }

    return [];
  }
}
