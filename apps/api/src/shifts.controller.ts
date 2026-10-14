import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { AuthGuard, Roles, TenantRequest } from "./auth.guard";
import { ShiftsService } from "./shifts.service";
import { CloseShiftDto, MovementDto, OpenShiftDto } from "./shifts.dto";
const uuid = () => new ParseUUIDPipe({ version: "4" });
@Controller("restaurant/branches/:branchId/cash/shifts")
@UseGuards(AuthGuard)
@Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
export class ShiftsController {
  constructor(private shifts: ShiftsService) {}
  @Get() list(
    @Req() req: TenantRequest,
    @Param("branchId", uuid()) branch: string,
  ) {
    return this.shifts.list(req.member, branch);
  }
  @Post() open(
    @Req() req: TenantRequest,
    @Param("branchId", uuid()) branch: string,
    @Body() dto: OpenShiftDto,
  ) {
    return this.shifts.open(req.member, branch, dto);
  }
  @Post(":id/movements") movement(
    @Req() req: TenantRequest,
    @Param("branchId", uuid()) branch: string,
    @Param("id", uuid()) id: string,
    @Body() dto: MovementDto,
  ) {
    return this.shifts.movement(req.member, branch, id, dto);
  }
  @Post(":id/close") close(
    @Req() req: TenantRequest,
    @Param("branchId", uuid()) branch: string,
    @Param("id", uuid()) id: string,
    @Body() dto: CloseShiftDto,
  ) {
    return this.shifts.close(req.member, branch, id, dto);
  }
}
