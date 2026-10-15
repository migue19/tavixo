import { restaurantBranding } from "./branding";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Membership,
  Order,
  OrderStatus,
  PaymentMethod,
  Prisma,
  Role,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "./prisma.service";
import {
  CancelItemDto,
  CreateRoundDto,
  CreateOrderDto,
  OrderStatusDto,
  CreatePaymentDto,
} from "./orders.dto";
import { Ticket, TicketKind } from "./ticket";
const include = {
  items: {
    include: {
      cancellations: {
        select: {
          id: true,
          quantity: true,
          reason: true,
          actorName: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" as const },
      },
    },
  },
  rounds: {
    include: {
      items: {
        include: {
          cancellations: {
            select: {
              id: true,
              quantity: true,
              reason: true,
              actorName: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" as const },
          },
        },
      },
    },
    orderBy: { number: "asc" as const },
  },
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
  private async ensureFirstRound(tx: Prisma.TransactionClient, order: Order) {
    let rounds = await tx.orderRound.findMany({
      where: {
        orderId: order.id,
        branchId: order.branchId,
        restaurantId: order.restaurantId,
      },
      orderBy: { number: "asc" },
    });
    if (!rounds.length) {
      const round = await tx.orderRound.create({
        data: {
          orderId: order.id,
          branchId: order.branchId,
          restaurantId: order.restaurantId,
          number: 1,
          status:
            order.status === OrderStatus.CLOSED
              ? OrderStatus.DELIVERED
              : order.status,
          requestId: order.requestId,
          requestHash: order.requestHash,
          notes: order.notes,
          createdByName: order.createdByName,
          createdAt: order.createdAt,
        },
      });
      rounds = [round];
    }
    await tx.orderItem.updateMany({
      where: {
        orderId: order.id,
        branchId: order.branchId,
        restaurantId: order.restaurantId,
        roundId: null,
      },
      data: { roundId: rounds[0].id },
    });
    return rounds;
  }
  private aggregate(statuses: OrderStatus[]): OrderStatus {
    statuses = statuses.filter((s) => s !== OrderStatus.CANCELLED);
    if (!statuses.length) return OrderStatus.CANCELLED;
    if (statuses.every((s) => s === OrderStatus.DELIVERED))
      return OrderStatus.DELIVERED;
    if (statuses.includes(OrderStatus.SENT)) return OrderStatus.SENT;
    if (statuses.includes(OrderStatus.PREPARING)) return OrderStatus.PREPARING;
    return OrderStatus.READY;
  }
  private async transitionRound(
    tx: Prisma.TransactionClient,
    member: Membership,
    name: string,
    order: Order,
    roundId: string,
    dto: OrderStatusDto,
  ) {
    const admin = this.admin(member);
    if (
      ([OrderStatus.PREPARING, OrderStatus.READY].includes(
        dto.status as "PREPARING" | "READY",
      ) &&
        !admin &&
        member.role !== Role.KITCHEN) ||
      (dto.status === OrderStatus.DELIVERED &&
        !admin &&
        ![Role.WAITER, Role.CASHIER].includes(
          member.role as "WAITER" | "CASHIER",
        ))
    )
      throw new ForbiddenException("Tu rol no permite ese cambio");
    if (terminal.includes(order.status as "CLOSED" | "CANCELLED"))
      throw new ConflictException("La cuenta ya terminó");
    const round = await tx.orderRound.findFirst({
      where: {
        id: roundId,
        orderId: order.id,
        branchId: order.branchId,
        restaurantId: member.restaurantId,
      },
    });
    if (!round) throw new NotFoundException("Ronda no encontrada");
    if (round.status !== dto.expectedStatus)
      throw new ConflictException(
        "La ronda cambió; actualiza antes de continuar",
      );
    const next: Partial<Record<OrderStatus, OrderStatus>> = {
      SENT: OrderStatus.PREPARING,
      PREPARING: OrderStatus.READY,
      READY: OrderStatus.DELIVERED,
    };
    if (next[round.status] !== dto.status)
      throw new ConflictException(
        "Ese cambio no corresponde al estado de la ronda",
      );
    await tx.orderRound.update({
      where: { id: roundId },
      data: { status: dto.status },
    });
    const rounds = await tx.orderRound.findMany({
      where: { orderId: order.id },
      select: { status: true },
    });
    return tx.order.update({
      where: { id: order.id },
      data: {
        status: this.aggregate(rounds.map((r) => r.status)),
        events: {
          create: {
            status: dto.status,
            actorName: name,
            reason: `Ronda ${round.number}`,
          },
        },
      },
      include,
    });
  }
  roundStatus(
    actor: Membership,
    branchId: string,
    id: string,
    roundId: string,
    dto: OrderStatusDto,
  ) {
    return this.write(actor, branchId, async (tx, member, name) => {
      const order = await tx.order.findFirst({
        where: { id, branchId, restaurantId: member.restaurantId },
      });
      if (!order) throw new NotFoundException("Comanda no encontrada");
      return this.transitionRound(tx, member, name, order, roundId, dto);
    });
  }
  addRound(
    actor: Membership,
    branchId: string,
    id: string,
    dto: CreateRoundDto,
  ) {
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          orderId: id,
          expectedTotalCents: dto.expectedTotalCents,
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
        throw new ForbiddenException("Cocina no puede agregar rondas");
      const replay = await tx.orderRound.findUnique({
        where: { branchId_requestId: { branchId, requestId: dto.requestId } },
      });
      if (replay) {
        if (replay.orderId !== id || replay.requestHash !== hash)
          throw new ConflictException(
            "La referencia ya corresponde a otro envío",
          );
        return tx.order.findFirstOrThrow({
          where: { id, branchId, restaurantId: member.restaurantId },
          include,
        });
      }
      const order = await tx.order.findFirst({
        where: { id, branchId, restaurantId: member.restaurantId },
        include: { payment: true },
      });
      if (!order) throw new NotFoundException("Comanda no encontrada");
      if (
        terminal.includes(order.status as "CLOSED" | "CANCELLED") ||
        order.payment
      )
        throw new ConflictException("La cuenta ya terminó");
      if (order.totalCents !== dto.expectedTotalCents)
        throw new ConflictException(
          "El total cambió; revisa la cuenta antes de agregar productos",
        );
      if (
        (await tx.orderItem.count({ where: { orderId: id } })) +
          dto.items.length >
        100
      )
        throw new BadRequestException(
          "La cuenta admite hasta 100 líneas de productos",
        );
      if (new Set(dto.items.map((i) => i.productId)).size !== dto.items.length)
        throw new BadRequestException(
          "Agrupa cada producto en una sola línea de esta ronda",
        );
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
      const items = dto.items.map((i) => {
        const p = products.find((p) => p.id === i.productId)!;
        return {
          productId: p.id,
          name: p.name,
          unitPriceCents: p.priceCents,
          quantity: i.quantity,
          notes: i.notes ?? "",
        };
      });
      const totalCents =
        order.totalCents +
        items.reduce((n, i) => n + i.quantity * i.unitPriceCents, 0);
      if (totalCents > 2147483647)
        throw new BadRequestException("El total excede el límite permitido");
      const rounds = await this.ensureFirstRound(tx, order);
      const number = rounds[rounds.length - 1].number + 1;
      await tx.orderRound.create({
        data: {
          orderId: id,
          branchId,
          restaurantId: member.restaurantId,
          number,
          requestId: dto.requestId,
          requestHash: hash,
          createdByName: name,
          notes: dto.notes ?? "",
          items: { create: items },
        },
      });
      return tx.order.update({
        where: { id },
        data: {
          totalCents,
          status: OrderStatus.SENT,
          events: {
            create: {
              status: OrderStatus.SENT,
              actorName: name,
              reason: `Ronda ${number} enviada`,
            },
          },
        },
        include,
      });
    });
  }
  cancelItem(
    actor: Membership,
    branchId: string,
    id: string,
    itemId: string,
    dto: CancelItemDto,
  ) {
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          id,
          itemId,
          quantity: dto.quantity,
          expectedCancelledQuantity: dto.expectedCancelledQuantity,
          expectedTotalCents: dto.expectedTotalCents,
          reason: dto.reason,
        }),
      )
      .digest("hex");
    return this.write(actor, branchId, async (tx, member, name) => {
      if (!this.admin(member))
        throw new ForbiddenException(
          "Sólo propietario o gerente puede cancelar productos",
        );
      const replay = await tx.itemCancellation.findUnique({
        where: { branchId_requestId: { branchId, requestId: dto.requestId } },
      });
      if (replay) {
        if (
          replay.requestHash !== hash ||
          replay.orderId !== id ||
          replay.itemId !== itemId
        )
          throw new ConflictException(
            "La referencia ya corresponde a otra cancelación",
          );
        return tx.order.findFirstOrThrow({
          where: { id, branchId, restaurantId: member.restaurantId },
          include,
        });
      }
      const order = await tx.order.findFirst({
        where: { id, branchId, restaurantId: member.restaurantId },
        include,
      });
      if (!order) throw new NotFoundException("Cuenta no encontrada");
      if (
        terminal.includes(order.status as "CLOSED" | "CANCELLED") ||
        order.payment
      )
        throw new ConflictException("La cuenta ya terminó");
      const item = order.items.find((i) => i.id === itemId);
      if (!item)
        throw new NotFoundException("Producto de cuenta no encontrado");
      if (
        order.totalCents !== dto.expectedTotalCents ||
        item.cancelledQuantity !== dto.expectedCancelledQuantity
      )
        throw new ConflictException(
          "La cuenta cambió; actualiza antes de cancelar",
        );
      if (dto.quantity > item.quantity - item.cancelledQuantity)
        throw new ConflictException(
          "La cantidad excede los productos vigentes",
        );
      await this.ensureFirstRound(tx, order);
      await tx.itemCancellation.create({
        data: {
          itemId,
          orderId: id,
          branchId,
          restaurantId: member.restaurantId,
          requestId: dto.requestId,
          requestHash: hash,
          quantity: dto.quantity,
          reason: dto.reason,
          actorName: name,
        },
      });
      await tx.orderItem.update({
        where: { id: itemId },
        data: { cancelledQuantity: { increment: dto.quantity } },
      });
      const rounds = await tx.orderRound.findMany({
        where: { orderId: id },
        include: { items: true },
      });
      for (const round of rounds)
        if (round.items.every((i) => i.quantity === i.cancelledQuantity)) {
          await tx.orderRound.update({
            where: { id: round.id },
            data: { status: OrderStatus.CANCELLED },
          });
          round.status = OrderStatus.CANCELLED;
        }
      const status = this.aggregate(rounds.map((r) => r.status));
      return tx.order.update({
        where: { id },
        data: {
          totalCents: order.totalCents - dto.quantity * item.unitPriceCents,
          status,
          events: {
            create: {
              status,
              actorName: name,
              reason: `Cancelación: ${dto.quantity} × ${item.name}. ${dto.reason}`,
            },
          },
        },
        include,
      });
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
  async ticket(
    member: Membership,
    branchId: string,
    id: string,
    kind: TicketKind,
  ): Promise<Ticket> {
    if (member.role === Role.KITCHEN)
      throw new ForbiddenException(
        "Cocina no tiene acceso a tickets de cuenta o pago",
      );
    return this.db.$transaction(
      async (tx) => {
        await this.branch(tx, member, branchId);
        const order = await tx.order.findFirst({
          where: { id, branchId, restaurantId: member.restaurantId },
          include: {
            items: { orderBy: { id: "asc" } },
            payment: true,
            branch: { include: { restaurant: true } },
          },
        });
        if (!order) throw new NotFoundException("Comanda no encontrada");
        if (order.status === OrderStatus.CANCELLED)
          throw new ConflictException("La cuenta está cancelada");
        if (
          kind === TicketKind.PAYMENT &&
          (!order.payment || order.status !== OrderStatus.CLOSED)
        )
          throw new ConflictException(
            "Esta cuenta no tiene un pago registrado",
          );
        const p = kind === TicketKind.PAYMENT ? order.payment : null;
        return {
          kind,
          title: kind === TicketKind.PAYMENT ? "Comprobante de pago" : "Cuenta",
          notice: order.payment
            ? "Pago registrado"
            : order.status === OrderStatus.CLOSED
              ? "Cuenta cerrada · sin pago registrado"
              : "Cuenta pendiente de pago",
          restaurant: order.branch.restaurant.name,
          branding: restaurantBranding(order.branch.restaurant.slug),
          branch: order.branch.name,
          address: order.branch.address,
          order: {
            id: order.id,
            number: order.number,
            tableName: order.tableName,
            createdAt: order.createdAt.toISOString(),
            createdByName: order.createdByName,
            totalCents: order.totalCents,
            items: order.items
              .filter((i) => i.quantity > i.cancelledQuantity)
              .map((i) => ({
                name: i.name,
                quantity: i.quantity - i.cancelledQuantity,
                unitPriceCents: i.unitPriceCents,
                lineTotalCents:
                  (i.quantity - i.cancelledQuantity) * i.unitPriceCents,
              })),
          },
          payment: p
            ? {
                id: p.id,
                method: p.method,
                amountCents: p.amountCents,
                cashAmountCents:
                  p.cashAmountCents ??
                  (p.method === PaymentMethod.CASH ? p.amountCents : 0),
                cardAmountCents:
                  p.cardAmountCents ??
                  (p.method === PaymentMethod.CARD ? p.amountCents : 0),
                receivedCents: p.receivedCents,
                changeCents: p.changeCents,
                reference: p.reference,
                actorName: p.actorName,
                createdAt: p.createdAt.toISOString(),
              }
            : null,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
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
      if (
        await tx.orderRound.findUnique({
          where: { branchId_requestId: { branchId, requestId: dto.requestId } },
        })
      )
        throw new ConflictException("La referencia ya corresponde a una ronda");
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
      const order = await tx.order.create({
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
      await this.ensureFirstRound(tx, order);
      return tx.order.findUniqueOrThrow({ where: { id: order.id }, include });
    });
  }
  pay(actor: Membership, branchId: string, id: string, dto: CreatePaymentDto) {
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          orderId: id,
          method: dto.method,
          ...(dto.cardAmountCents !== undefined
            ? { cardAmountCents: dto.cardAmountCents }
            : {}),
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
      const rounds = await this.ensureFirstRound(tx, order);
      if (
        !rounds
          .filter((r) => r.status !== OrderStatus.CANCELLED)
          .every((r) => r.status === OrderStatus.DELIVERED)
      )
        throw new ConflictException("Entrega todas las rondas antes de cobrar");
      if (dto.expectedTotalCents !== order.totalCents)
        throw new ConflictException(
          "El total cambió; revisa la cuenta antes de cobrar",
        );
      if (
        dto.method !== PaymentMethod.MIXED &&
        dto.cardAmountCents !== undefined
      )
        throw new BadRequestException(
          "El importe parcial con tarjeta corresponde sólo al pago mixto",
        );
      const cardAmountCents =
        dto.method === PaymentMethod.CARD
          ? order.totalCents
          : dto.method === PaymentMethod.MIXED
            ? dto.cardAmountCents
            : 0;
      if (
        cardAmountCents === undefined ||
        (dto.method === PaymentMethod.MIXED &&
          (cardAmountCents <= 0 || cardAmountCents >= order.totalCents))
      )
        throw new BadRequestException(
          "El pago mixto requiere importes positivos en efectivo y tarjeta que cubran el total",
        );
      const cashAmountCents = order.totalCents - cardAmountCents;
      if (dto.receivedCents < order.totalCents)
        throw new BadRequestException("El importe recibido no cubre la cuenta");
      if (
        dto.method === PaymentMethod.CARD &&
        dto.receivedCents !== order.totalCents
      )
        throw new BadRequestException(
          "El importe con tarjeta debe coincidir con el total",
        );
      if (dto.method !== PaymentMethod.CASH && !dto.reference?.trim())
        throw new BadRequestException("Indica el folio de la terminal");
      if (dto.method === PaymentMethod.CASH && dto.reference)
        throw new BadRequestException(
          "El folio de terminal corresponde sólo a pagos con tarjeta",
        );
      const shift = await tx.cashShift.findFirst({
        where: { branchId, restaurantId: member.restaurantId, closedAt: null },
      });
      if (shift)
        await tx.cashShift.update({
          where: { id: shift.id },
          data: { revision: { increment: 1 } },
        });
      await tx.payment.create({
        data: {
          shiftId: shift?.id ?? null,
          orderId: id,
          branchId,
          restaurantId: member.restaurantId,
          requestId: dto.requestId,
          requestHash: hash,
          method: dto.method,
          amountCents: order.totalCents,
          cashAmountCents,
          cardAmountCents,
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
                  : dto.method === PaymentMethod.MIXED
                    ? "Cobro mixto registrado"
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
      const rounds = await this.ensureFirstRound(tx, order);
      if (dto.status !== OrderStatus.CANCELLED) {
        if (rounds.length !== 1)
          throw new ConflictException("Actualiza cada ronda por separado");
        return this.transitionRound(tx, member, name, order, rounds[0].id, dto);
      }
      await tx.orderRound.updateMany({
        where: { orderId: id, status: { not: OrderStatus.DELIVERED } },
        data: { status: OrderStatus.CANCELLED },
      });
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
