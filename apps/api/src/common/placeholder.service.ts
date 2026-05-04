import { Injectable } from '@nestjs/common';

@Injectable()
export class PlaceholderService {
  list(scope: string) {
    return {
      scope,
      status: 'scaffolded',
      next: 'Implement DTO validation, permission guards, and service-layer business rules.',
    };
  }

  action(scope: string, action: string) {
    return {
      scope,
      action,
      status: 'accepted_for_implementation',
    };
  }
}
