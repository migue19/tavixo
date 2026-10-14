import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { AuthGuard, TenantRequest } from "./auth.guard";
import { LoginDto, SwitchRestaurantDto } from "./dto";
import { config } from "./config";
@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}
  private checkOrigin(req: Request) {
    if (req.headers.origin !== config().origin)
      throw new ForbiddenException("Origen inválido");
  }
  private options() {
    return {
      httpOnly: true,
      secure: config().secure,
      sameSite: "strict" as const,
      path: "/api/auth",
    };
  }
  private deliver(
    res: Response,
    result: Awaited<ReturnType<AuthService["login"]>>,
  ) {
    const { refreshToken, ...body } = result;
    res.cookie("tavixo_refresh", refreshToken, {
      ...this.options(),
      maxAge: config().refreshMs,
    });
    res.setHeader("Cache-Control", "no-store");
    return body;
  }
  @Post("login")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkOrigin(req);
    return this.deliver(res, await this.auth.login(dto));
  }
  @Post("refresh")
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkOrigin(req);
    try {
      return this.deliver(
        res,
        await this.auth.refresh(req.cookies?.tavixo_refresh ?? ""),
      );
    } catch (error) {
      res.clearCookie("tavixo_refresh", this.options());
      throw error;
    }
  }
  @Post("switch")
  @UseGuards(AuthGuard)
  async switchRestaurant(
    @Req() req: TenantRequest,
    @Body() dto: SwitchRestaurantDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkOrigin(req);
    return this.deliver(
      res,
      await this.auth.switchRestaurant(
        req.member.userId,
        dto.restaurantId,
        req.cookies?.tavixo_refresh,
      ),
    );
  }
  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.checkOrigin(req);
    await this.auth.logout(req.cookies?.tavixo_refresh);
    res.clearCookie("tavixo_refresh", this.options());
    return { ok: true };
  }
}
