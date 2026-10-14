import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Membership,
  OrderStatus,
  PaymentMethod,
  Prisma,
  Role,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "./prisma.service";
import { CreateOrderDto, OrderStatusDto, CreatePaymentDto } from "./orders.dto";
const include = {
  items: true,
  payment: true,
  events: { orderBy: { createdAt: "asc" as const } },
};
const terminal = [OrderStatus.CLOSED, OrderStatus.CANCELLED];
@Injectable()
export class OrdersService {
  constructor(private db: PrismaService) {}
  private admin(member: Membership) {
    return member.role === Role.OWNER || member.role === Role.MANAGER;
  }
  private async branch(
    db: Prisma.TransactionClient,
    member: Membership,
    branchId: string,
  ) {
    if (!this.admin(member) && member.branchId !== branchId)
      throw new ForbiddenException(
        "Sólo puedes consultar tu sucursal asignada",
      );
    const branch = await db.branch.findFirst({
      where: { id: branchId, restaurantId: member.restaurantId },
    });
    if (!branch) throw new NotFoundException("Sucursal no encontrada");
    if (!branch.active)
      throw new BadRequestException("La sucursal está inactiva");
  }
  private async write<T>(
    actor: Membership,
    branchId: string,
    fn: (
      tx: Prisma.TransactionClient,
      member: Membership,
      name: string,
    ) => Promise<T>,
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Restaurant" WHERE id = ${actor.restaurantId}::uuid FOR UPDATE`;
      const member = await tx.membership.findFirst({
        where: {
          id: actor.id,
          restaurantId: actor.restaurantId,
          active: true,
          user: { active: true },
          restaurant: { active: true },
        },
        include: { user: { select: { name: true } } },
      });
      if (!member) throw new ForbiddenException();
      await this.branch(tx, member, branchId);
      return fn(tx, member, member.user.name);
    });
  }
  async list(member: Membership, branchId: string) {
    await this.branch(this.db, member, branchId);
    // All open accounts plus the last 50 terminal accounts, bounded history.
    const where = { restaurantId: member.restaurantId, branchId };
    const [open, recent] = await Promise.all([
      this.db.order.findMany({
        where: { ...where, status: { notIn: terminal } },
        include,
        orderBy: { createdAt: "asc" },
      }),
      this.db.order.findMany({
        where: { ...where, status: { in: terminal } },
        include,
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
    ]);
    return [...open, ...recent];
  }
  create(actor: Membership, branchId: string, dto: CreateOrderDto) {
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          tableId: dto.tableId,
          notes: dto.notes ?? "",
          items: dto.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            notes: i.notes ?? "",
          })),
        }),
      )
      .digest("hex");
    return this.write(actor, branchId, async (tx, member, name) => {
      if (member.role === Role.KITCHEN)
        throw new ForbiddenException("Cocina no puede crear comandas");
      const existing = await tx.order.findUnique({
        where: { branchId_requestId: { branchId, requestId: dto.requestId } },
        include,
      });
      if (existing) {
        if (existing.requestHash !== hash)
          throw new ConflictException(
            "La referencia de envío ya corresponde a otra comanda",
          );
        return existing;
      }
      const table = await tx.diningTable.findFirst({
        where: {
          id: dto.tableId,
          branchId,
          restaurantId: member.restaurantId,
          active: true,
        },
      });
      if (!table)
        throw new BadRequestException(
          "Selecciona una mesa activa de esta sucursal",
        );
      if (
        await tx.order.findFirst({
          where: {
            tableId: table.id,
            branchId,
            restaurantId: member.restaurantId,
            status: { notIn: terminal },
          },
        })
      )
        throw new ConflictException("La mesa ya tiene una cuenta abierta");
      if (new Set(dto.items.map((i) => i.productId)).size !== dto.items.length)
        throw new BadRequestException("Agrupa cada producto en una sola línea");
      const products = await tx.product.findMany({
        where: {
          id: { in: dto.items.map((i) => i.productId) },
          branchId,
          restaurantId: member.restaurantId,
          active: true,
          available: true,
          category: { active: true },
        },
      });
      if (products.length !== dto.items.length)
        throw new BadRequestException(
          "Algún producto está agotado o ya no está en el menú",
        );
      const items = dto.items.map((line) => {
        const product = products.find((p) => p.id === line.productId)!;
        return {
          productId: product.id,
          name: product.name,
          unitPriceCents: product.priceCents,
          quantity: line.quantity,
          notes: line.notes ?? "",
        };
      });
      const totalCents = items.reduce(
        (sum, i) => sum + i.quantity * i.unitPriceCents,
        0,
      );
      if (totalCents > 2147483647)
        throw new BadRequestException("El total excede el límite permitido");
      const last = await tx.order.aggregate({
        where: { branchId },
        _max: { number: true },
      });
      return tx.order.create({
        data: {
          restaurantId: member.restaurantId,
          branchId,
          tableId: table.id,
          tableName: table.name,
          createdByName: name,
          number: (last._max.number ?? 0) + 1,
          requestId: dto.requestId,
          requestHash: hash,
          totalCents,
          notes: dto.notes ?? "",
          items: { create: items },
          events: { create: { status: OrderStatus.SENT, actorName: name } },
        },
        include,
      });
    });
  }
  pay(actor: Membership, branchId: string, id: string, dto: CreatePaymentDto) {
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          orderId: id,
          method: dto.method,
          receivedCents: dto.receivedCents,
          expectedTotalCents: dto.expectedTotalCents,
          reference: dto.reference ?? "",
        }),
      )
      .digest("hex");
    return this.write(actor, branchId, async (tx, member, name) => {
      if (!this.admin(member) && member.role !== Role.CASHIER)
        throw new ForbiddenException(
          "Sólo caja o administración puede registrar cobros",
        );
      const replay = await tx.payment.findUnique({
        where: { branchId_requestId: { branchId, requestId: dto.requestId } },
      });
      if (replay) {
        if (
          replay.restaurantId !== member.restaurantId ||
          replay.orderId !== id ||
          replay.requestHash !== hash
        )
          throw new ConflictException(
            "La referencia ya corresponde a otro cobro",
          );
        return tx.order.findFirstOrThrow({
          where: { id, restaurantId: member.restaurantId, branchId },
          include,
        });
      }
      const order = await tx.order.findFirst({
        where: { id, restaurantId: member.restaurantId, branchId },
        include,
      });
      if (!order) throw new NotFoundException("Comanda no encontrada");
      if (order.payment || order.status !== OrderStatus.DELIVERED)
        throw new ConflictException(
          "La cuenta debe estar entregada y sin cobro registrado",
        );
      if (dto.expectedTotalCents !== order.totalCents)
        throw new ConflictException(
          "El total cambió; revisa la cuenta antes de cobrar",
        );
      if (dto.receivedCents < order.totalCents)
        throw new BadRequestException("El importe recibido no cubre la cuenta");
      if (dto.method === PaymentMethod.CARD) {
        if (dto.receivedCents !== order.totalCents)
          throw new BadRequestException(
            "El importe con tarjeta debe coincidir con el total",
          );
        if (!dto.reference?.trim())
          throw new BadRequestException("Indica el folio de la terminal");
      } else if (dto.reference)
        throw new BadRequestException(
          "El folio de terminal corresponde sólo a pagos con tarjeta",
        );
      await tx.payment.create({
        data: {
          orderId: id,
          branchId,
          restaurantId: member.restaurantId,
          requestId: dto.requestId,
          requestHash: hash,
          method: dto.method,
          amountCents: order.totalCents,
          receivedCents: dto.receivedCents,
          changeCents: dto.receivedCents - order.totalCents,
          reference: dto.reference ?? "",
          actorName: name,
        },
      });
      return tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.CLOSED,
          events: {
            create: {
              status: OrderStatus.CLOSED,
              actorName: name,
              reason:
                dto.method === PaymentMethod.CASH
                  ? "Cobro en efectivo registrado"
                  : "Cobro con tarjeta registrado",
            },
          },
        },
        include,
      });
    });
  }
  status(actor: Membership, branchId: string, id: string, dto: OrderStatusDto) {
    return this.write(actor, branchId, async (tx, member, name) => {
      const order = await tx.order.findFirst({
        where: { id, branchId, restaurantId: member.restaurantId },
        include,
      });
      if (!order) throw new NotFoundException("Comanda no encontrada");
      const admin = this.admin(member);
      const kitchen = admin || member.role === Role.KITCHEN;
      const floor =
        admin || member.role === Role.WAITER || member.role === Role.CASHIER;
      if (
        (dto.status === OrderStatus.CANCELLED && !admin) ||
        ([OrderStatus.PREPARING, OrderStatus.READY].includes(
          dto.status as "PREPARING" | "READY",
        ) &&
          !kitchen) ||
        ([OrderStatus.DELIVERED, OrderStatus.CLOSED].includes(
          dto.status as "DELIVERED" | "CLOSED",
        ) &&
          !floor)
      )
        throw new ForbiddenException("Tu rol no permite ese cambio");
      if (order.status !== dto.expectedStatus)
        throw new ConflictException(
          "La comanda cambió; actualiza antes de continuar",
        );
      if (dto.status === OrderStatus.CLOSED)
        throw new BadRequestException(
          "Registra el cobro para cerrar la cuenta",
        );
      const next: Partial<Record<OrderStatus, OrderStatus>> = {
        SENT: OrderStatus.PREPARING,
        PREPARING: OrderStatus.READY,
        READY: OrderStatus.DELIVERED,
      };
      if (dto.status === OrderStatus.CANCELLED) {
        if (terminal.includes(order.status as "CLOSED" | "CANCELLED"))
          throw new ConflictException("La cuenta ya terminó");
        if (!dto.reason?.trim())
          throw new BadRequestException("Indica el motivo de cancelación");
      } else if (next[order.status] !== dto.status)
        throw new ConflictException(
          "Ese cambio no corresponde al estado actual",
        );
      return tx.order.update({
        where: { id },
        data: {
          status: dto.status,
          events: {
            create: {
              status: dto.status,
              actorName: name,
              reason: dto.reason ?? "",
            },
          },
        },
        include,
      });
    });
  }
}
