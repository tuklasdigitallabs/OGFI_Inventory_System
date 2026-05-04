import { Injectable } from '@nestjs/common';
import { PlaceholderService } from '../common/placeholder.service';

@Injectable()
export class AdminService {
  constructor(private readonly placeholder: PlaceholderService) {}

  list(resource: string, query?: Record<string, string>) {
    return {
      ...this.placeholder.list(`admin.${resource}`),
      query,
    };
  }

  action(action: string, payload: unknown) {
    return {
      ...this.placeholder.action('admin', action),
      payload,
    };
  }
}
