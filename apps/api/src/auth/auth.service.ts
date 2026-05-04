import { Injectable } from '@nestjs/common';
import { PlaceholderService } from '../common/placeholder.service';

@Injectable()
export class AuthService {
  constructor(private readonly placeholder: PlaceholderService) {}

  action(action: string, payload: unknown) {
    return {
      ...this.placeholder.action('auth', action),
      payload,
    };
  }
}
