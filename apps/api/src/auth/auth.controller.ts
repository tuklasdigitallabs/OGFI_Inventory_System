import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: unknown) {
    return this.authService.action('login', body);
  }

  @Post('refresh')
  refresh(@Body() body: unknown) {
    return this.authService.action('refresh', body);
  }

  @Post('logout')
  logout(@Body() body: unknown) {
    return this.authService.action('logout', body);
  }

  @Post('password-reset/request')
  requestPasswordReset(@Body() body: unknown) {
    return this.authService.action('password-reset/request', body);
  }

  @Post('password-reset/confirm')
  confirmPasswordReset(@Body() body: unknown) {
    return this.authService.action('password-reset/confirm', body);
  }
}
