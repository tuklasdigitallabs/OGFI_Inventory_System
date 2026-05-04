import { Injectable } from '@nestjs/common';
import { PlaceholderService } from '../common/placeholder.service';

@Injectable()
export class TransfersService {
  constructor(private readonly placeholder: PlaceholderService) {}

  list(resource: string, query?: Record<string, string>) {
    return {
      ...this.placeholder.list(`transfers.${resource}`),
      query,
    };
  }

  action(action: string, payload: unknown) {
    return {
      ...this.placeholder.action('transfers', action),
      payload,
    };
  }
}
