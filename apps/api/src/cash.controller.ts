import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { AuthGuard, Roles, TenantRequest } from "./auth.guard";
import { CashQuery, CreateCashCutDto } from "./cash.dto";
import { CashService } from "./cash.service";
@Controller("restaurant/branches/:branchId/cash")
@UseGuards(AuthGuard)
@Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
export class CashController {
  constructor(private cash: CashService) {}
  @Get("summary") report(
    @Req() req: TenantRequest,
    @Param("branchId", new ParseUUIDPipe({ version: "4" })) branch: string,
    @Query() query: CashQuery,
  ) {
    return this.cash.report(req.member, branch, query.day);
  }
  @Get("cuts") list(
    @Req() req: TenantRequest,
    @Param("branchId", new ParseUUIDPipe({ version: "4" })) branch: string,
    @Query() query: CashQuery,
  ) {
    return this.cash.list(req.member, branch, query.day);
  }
  @Post("cuts") create(
    @Req() req: TenantRequest,
    @Param("branchId", new ParseUUIDPipe({ version: "4" })) branch: string,
    @Body() dto: CreateCashCutDto,
  ) {
    return this.cash.create(req.member, branch, dto);
  }
}
