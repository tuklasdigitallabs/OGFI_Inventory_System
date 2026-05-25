import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Public } from "./decorators/public.decorator";
import {
  ChangePasswordDto,
  LoginDto,
  OfflinePinDto,
  RefreshTokenDto,
} from "./dto/login.dto";
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
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.login(body, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
    this.setRefreshCookie(response, session.refreshToken);
    return this.withoutRefreshToken(session);
  }

  @Public()
  @Post("refresh")
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken =
      body.refreshToken ?? this.cookieValue(request, "ogfi_refresh");
    const session = await this.authService.refresh({ refreshToken }, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
    this.setRefreshCookie(response, session.refreshToken);
    return this.withoutRefreshToken(session);
  }

  @Post("logout")
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.logout(user, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
    response.clearCookie("ogfi_refresh", this.refreshCookieOptions());
    return result;
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

  private setRefreshCookie(response: Response, refreshToken: string) {
    response.cookie("ogfi_refresh", refreshToken, this.refreshCookieOptions());
  }

  private refreshCookieOptions() {
    return {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/api/auth/refresh",
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
    };
  }

  private cookieValue(request: Request, name: string) {
    const cookies = request.headers.cookie?.split(";") ?? [];
    const match = cookies
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${name}=`));

    return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
  }

  private withoutRefreshToken<T extends { refreshToken: string }>(session: T) {
    const { refreshToken: _refreshToken, ...response } = session;

    return response;
  }
}
