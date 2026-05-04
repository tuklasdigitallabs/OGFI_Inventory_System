import { Injectable } from '@nestjs/common';

@Injectable()
export class RbacService {
  canAccessLocation(userLocationIds: string[], locationId: string) {
    return userLocationIds.includes(locationId);
  }

  hasPermission(userPermissions: string[], permission: string) {
    return userPermissions.includes(permission);
  }
}
