import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Query,
  StreamableFile,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { AuthGuard, Roles, TenantRequest } from "./auth.guard";
import { CreateOrderDto, OrderStatusDto, CreatePaymentDto } from "./orders.dto";
import { OrdersService } from "./orders.service";
import { Response } from "express";
import { TicketQuery, ticketPdf } from "./ticket";
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
  @Get(":id/ticket")
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER, Role.WAITER)
  ticket(
    @Req() req: TenantRequest,
    @Param("branchId", uuid()) branch: string,
    @Param("id", uuid()) id: string,
    @Query() query: TicketQuery,
  ) {
    return this.orders.ticket(req.member, branch, id, query.kind);
  }
  @Get(":id/ticket.pdf")
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER, Role.WAITER)
  async pdf(
    @Req() req: TenantRequest,
    @Param("branchId", uuid()) branch: string,
    @Param("id", uuid()) id: string,
    @Query() query: TicketQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ticket = await this.orders.ticket(req.member, branch, id, query.kind);
    const buffer = await ticketPdf(ticket);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="tavixo-${query.kind.toLowerCase()}-${ticket.order.number}.pdf"`,
    );
    return new StreamableFile(buffer, {
      type: "application/pdf",
      length: buffer.length,
    });
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
