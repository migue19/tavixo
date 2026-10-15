import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { IsString, Matches } from "class-validator";
import { AuthGuard, Roles, TenantRequest } from "./auth.guard";
import { ReportsService } from "./reports.service";
export class SalesQuery {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
}
@Controller("restaurant/branches/:branchId/reports")
@UseGuards(AuthGuard)
@Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
export class ReportsController {
  constructor(private reports: ReportsService) {}
  @Get("sales") sales(
    @Req() req: TenantRequest,
    @Param("branchId", new ParseUUIDPipe({ version: "4" })) branch: string,
    @Query() query: SalesQuery,
  ) {
    return this.reports.sales(req.member, branch, query.from, query.to);
  }
}
