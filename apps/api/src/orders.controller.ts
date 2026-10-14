import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { AuthGuard, Roles, TenantRequest } from "./auth.guard";
import { CreateOrderDto, OrderStatusDto, CreatePaymentDto } from "./orders.dto";
import { OrdersService } from "./orders.service";
const uuid = () => new ParseUUIDPipe({ version: "4" });
@Controller("restaurant/branches/:branchId/orders")
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private orders: OrdersService) {}
  @Get() list(
    @Req() req: TenantRequest,
    @Param("branchId", uuid()) branch: string,
  ) {
    return this.orders.list(req.member, branch);
  }
  @Post()
  @Roles(Role.OWNER, Role.MANAGER, Role.WAITER, Role.CASHIER)
  create(
    @Req() req: TenantRequest,
    @Param("branchId", uuid()) branch: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.orders.create(req.member, branch, dto);
  }
  @Post(":id/payment")
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  payment(
    @Req() req: TenantRequest,
    @Param("branchId", uuid()) branch: string,
    @Param("id", uuid()) id: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.orders.pay(req.member, branch, id, dto);
  }
  @Patch(":id/status")
  status(
    @Req() req: TenantRequest,
    @Param("branchId", uuid()) branch: string,
    @Param("id", uuid()) id: string,
    @Body() dto: OrderStatusDto,
  ) {
    return this.orders.status(req.member, branch, id, dto);
  }
}
