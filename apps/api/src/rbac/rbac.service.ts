import { Injectable } from '@nestjs/common';

@Injectable()
export class RbacService {
  canAccessLocation(userLocationIds: string[], locationId: string) {
    return userLocationIds.includes(locationId);
  }

  canAccessAllLocations(userLocationIds: string[], locationIds: string[]) {
    return locationIds.every((locationId) => this.canAccessLocation(userLocationIds, locationId));
  }

  hasPermission(userPermissions: string[], permission: string) {
    return userPermissions.includes(permission);
  }

  hasAllPermissions(userPermissions: string[], requiredPermissions: string[]) {
    return requiredPermissions.every((permission) => this.hasPermission(userPermissions, permission));
  }
}
