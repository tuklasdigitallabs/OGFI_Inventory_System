import { Injectable } from '@nestjs/common';
import { PlaceholderService } from '../common/placeholder.service';

@Injectable()
export class LedgerService {
  constructor(private readonly placeholder: PlaceholderService) {}

  list(resource: string, query?: Record<string, string>) {
    return {
      ...this.placeholder.list(resource),
      query,
    };
  }

  action(action: string, payload: unknown) {
    return {
      ...this.placeholder.action('ledger', action),
      payload,
    };
  }
}
