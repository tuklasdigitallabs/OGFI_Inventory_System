import { Injectable } from '@nestjs/common';
import { PlaceholderService } from '../common/placeholder.service';

@Injectable()
export class SalesService {
  constructor(private readonly placeholder: PlaceholderService) {}

  list(resource: string, query?: Record<string, string>) {
    return {
      ...this.placeholder.list(`sales.${resource}`),
      query,
    };
  }

  action(action: string, payload: unknown) {
    return {
      ...this.placeholder.action('sales', action),
      payload,
    };
  }
}
