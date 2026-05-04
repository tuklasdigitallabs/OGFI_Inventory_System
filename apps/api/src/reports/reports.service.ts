import { Injectable } from '@nestjs/common';
import { PlaceholderService } from '../common/placeholder.service';

@Injectable()
export class ReportsService {
  constructor(private readonly placeholder: PlaceholderService) {}

  list(resource: string, query?: Record<string, string>) {
    return {
      ...this.placeholder.list(`reports.${resource}`),
      query,
    };
  }

  action(action: string, payload: unknown) {
    return {
      ...this.placeholder.action('reports', action),
      payload,
    };
  }
}
