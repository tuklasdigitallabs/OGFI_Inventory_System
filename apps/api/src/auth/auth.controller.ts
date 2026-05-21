import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Public } from "./decorators/public.decorator";
import { ChangePasswordDto, LoginDto, OfflinePinDto } from "./dto/login.dto";
import { AuthService } from "./auth.service";
import { AuthenticatedUser } from "./types";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get("altcha-challenge")
  captchaChallenge() {
    return this.authService.createAltchaChallenge();
  }

  @Public()
  @Post("login")
  login(@Body() body: LoginDto, @Req() request: Request) {
    return this.authService.login(body, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Post("refresh")
  refresh() {
    return this.authService.refresh();
  }

  @Post("logout")
  logout(@CurrentUser() user: AuthenticatedUser, @Req() request: Request) {
    return this.authService.logout(user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.currentUser(user);
  }

  @Post("change-password")
  changePassword(
    @Body() body: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.authService.changePassword(body, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Get("offline-pin-status")
  offlinePinStatus() {
    return this.authService.offlinePinStatus();
  }

  @Post("offline-pin/verify")
  verifyOfflinePin(
    @Body() body: OfflinePinDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.authService.verifyOfflinePin(body, user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Public()
  @Post("password-reset/request")
  requestPasswordReset() {
    return {
      status: "deferred",
      next: "Password reset workflow will be implemented with notification support.",
    };
  }

  @Public()
  @Post("password-reset/confirm")
  confirmPasswordReset() {
    return {
      status: "deferred",
      next: "Password reset workflow will be implemented with notification support.",
    };
  }
}
