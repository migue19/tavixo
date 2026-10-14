import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Membership, Prisma, Role } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "./prisma.service";
import { CreateCashCutDto } from "./cash.dto";
const timezone = "America/Mexico_City";
export function mexicoDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
// Resolve local midnight using the runtime timezone database, including historical offsets.
function midnight(day: string) {
  const target = Date.parse(`${day}T00:00:00Z`);
  let value = target;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 3; i++) {
    const p = fmt.formatToParts(new Date(value));
    const get = (t: string) => Number(p.find((v) => v.type === t)!.value);
    const local = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
    value += target - local;
  }
  return new Date(value);
}
export function cashRange(day: string, now = new Date()) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    day < "2000-01-01" ||
    day > mexicoDay(now)
  )
    throw new BadRequestException("Selecciona un día válido, hasta hoy");
  const parsed = new Date(`${day}T00:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== day
  )
    throw new BadRequestException("Fecha inválida");
  const next = new Date(parsed.getTime() + 86400000).toISOString().slice(0, 10);
  return {
    start: midnight(day),
    end: new Date(Math.min(midnight(next).getTime(), now.getTime())),
    generatedAt: now,
  };
}
@Injectable()
export class CashService {
  constructor(private db: PrismaService) {}
  private async branch(
    tx: Prisma.TransactionClient,
    member: Membership,
    branchId: string,
  ) {
    if (
      ![Role.OWNER, Role.MANAGER, Role.CASHIER].includes(
        member.role as "OWNER" | "MANAGER" | "CASHIER",
      )
    )
      throw new ForbiddenException();
    if (member.role === Role.CASHIER && member.branchId !== branchId)
      throw new ForbiddenException(
        "Sólo puedes consultar tu sucursal asignada",
      );
    const branch = await tx.branch.findFirst({
      where: { id: branchId, restaurantId: member.restaurantId },
      include: { restaurant: { select: { name: true } } },
    });
    if (!branch) throw new NotFoundException("Sucursal no encontrada");
    return branch;
  }
  private async summary(
    tx: Prisma.TransactionClient,
    member: Membership,
    branchId: string,
    day: string,
  ) {
    const branch = await this.branch(tx, member, branchId);
    const range = cashRange(day);
    const where = {
      restaurantId: member.restaurantId,
      branchId,
      createdAt: { gte: range.start, lt: range.end },
    };
    const groups = await tx.payment.groupBy({
      by: ["method"],
      where,
      _count: { _all: true },
      _sum: { amountCents: true, receivedCents: true, changeCents: true },
    });
    const method = (name: "CASH" | "CARD") => {
      const row = groups.find((g) => g.method === name);
      return {
        count: row?._count._all ?? 0,
        totalCents: row?._sum.amountCents ?? 0,
        receivedCents: row?._sum.receivedCents ?? 0,
        changeCents: row?._sum.changeCents ?? 0,
      };
    };
    const cash = method("CASH"),
      card = method("CARD");
    const payments = await tx.payment.findMany({
      where,
      take: 200,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        method: true,
        amountCents: true,
        receivedCents: true,
        changeCents: true,
        reference: true,
        actorName: true,
        createdAt: true,
        order: { select: { id: true, number: true, tableName: true } },
      },
    });
    const totalCents = cash.totalCents + card.totalCents;
    if (
      ![totalCents, cash.receivedCents, cash.changeCents].every(
        Number.isSafeInteger,
      )
    )
      throw new BadRequestException(
        "Los importes exceden el límite del resumen",
      );
    return {
      day,
      timezone,
      branch: { id: branch.id, name: branch.name },
      restaurantName: branch.restaurant.name,
      periodStart: range.start.toISOString(),
      periodEnd: range.end.toISOString(),
      generatedAt: range.generatedAt.toISOString(),
      paymentCount: cash.count + card.count,
      totalCents,
      cash,
      card,
      payments: payments.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
      detailLimit: 200,
    };
  }
  report(member: Membership, branchId: string, day: string) {
    return this.db.$transaction(
      (tx) => this.summary(tx, member, branchId, day),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  list(member: Membership, branchId: string, day: string) {
    cashRange(day);
    return this.db.$transaction(
      async (tx) => {
        await this.branch(tx, member, branchId);
        return tx.cashCut.findMany({
          where: { restaurantId: member.restaurantId, branchId, day },
          take: 50,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            day: true,
            openingCents: true,
            countedCents: true,
            actorName: true,
            notes: true,
            snapshot: true,
            createdAt: true,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  create(actor: Membership, branchId: string, dto: CreateCashCutDto) {
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          day: dto.day,
          requestId: dto.requestId,
          openingCents: dto.openingCents,
          countedCents: dto.countedCents,
          expectedTotalCents: dto.expectedTotalCents,
          expectedPaymentCount: dto.expectedPaymentCount,
          notes: dto.notes ?? "",
        }),
      )
      .digest("hex");
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
      const previous = await tx.cashCut.findUnique({
        where: { branchId_requestId: { branchId, requestId: dto.requestId } },
      });
      if (previous) {
        if (previous.requestHash !== hash)
          throw new ConflictException(
            "La referencia ya corresponde a otro corte",
          );
        const { requestHash: _hash, requestId: _request, ...result } = previous;
        return result;
      }
      const summary = await this.summary(tx, member, branchId, dto.day);
      if (
        summary.totalCents !== dto.expectedTotalCents ||
        summary.paymentCount !== dto.expectedPaymentCount
      )
        throw new ConflictException(
          "Los cobros cambiaron; actualiza el resumen antes de guardar el corte",
        );
      const expectedCents = dto.openingCents + summary.cash.totalCents;
      if (!Number.isSafeInteger(expectedCents))
        throw new BadRequestException("Importe fuera del límite");
      const snapshot = {
        ...summary,
        expectedCents,
        differenceCents: dto.countedCents - expectedCents,
      };
      const result = await tx.cashCut.create({
        data: {
          restaurantId: member.restaurantId,
          branchId,
          day: dto.day,
          requestId: dto.requestId,
          requestHash: hash,
          openingCents: dto.openingCents,
          countedCents: dto.countedCents,
          actorName: member.user.name,
          notes: dto.notes ?? "",
          snapshot: snapshot as Prisma.InputJsonValue,
        },
      });
      const { requestHash: _hash, requestId: _request, ...view } = result;
      return view;
    });
  }
}
