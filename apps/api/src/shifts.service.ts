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
import { CloseShiftDto, MovementDto, OpenShiftDto } from "./shifts.dto";
const select = {
  id: true,
  branchId: true,
  openingCents: true,
  openedByName: true,
  openedAt: true,
  revision: true,
  closedAt: true,
  closedByName: true,
  countedCents: true,
  notes: true,
  snapshot: true,
};
const hash = (value: object) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
@Injectable()
export class ShiftsService {
  constructor(private db: PrismaService) {}
  private async scope(
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
      throw new ForbiddenException("Sólo puedes operar tu sucursal asignada");
    const branch = await tx.branch.findFirst({
      where: { id: branchId, restaurantId: member.restaurantId },
    });
    if (!branch) throw new NotFoundException("Sucursal no encontrada");
    return branch;
  }
  private write<T>(
    actor: Membership,
    branchId: string,
    fn: (
      tx: Prisma.TransactionClient,
      member: Membership,
      name: string,
    ) => Promise<T>,
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Restaurant" WHERE id=${actor.restaurantId}::uuid FOR UPDATE`;
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
      await this.scope(tx, member, branchId);
      return fn(tx, member, member.user.name);
    });
  }
  private async summary(tx: Prisma.TransactionClient, id: string) {
    const payments = await tx.payment.groupBy({
      by: ["method"],
      where: { shiftId: id },
      _count: { _all: true },
      _sum: {
        amountCents: true,
        cashAmountCents: true,
        cardAmountCents: true,
        receivedCents: true,
        changeCents: true,
      },
    });
    const cash = payments.find((p) => p.method === "CASH"),
      card = payments.find((p) => p.method === "CARD"),
      mixed = payments.find((p) => p.method === "MIXED");
    const cashCents =
        (cash?._sum.amountCents ?? 0) + (mixed?._sum.cashAmountCents ?? 0),
      cardCents =
        (card?._sum.amountCents ?? 0) + (mixed?._sum.cardAmountCents ?? 0);
    const groups = await tx.cashMovement.groupBy({
      by: ["kind"],
      where: { shiftId: id },
      _count: { _all: true },
      _sum: { amountCents: true },
    });
    const withdrawalsCents =
        groups.find((g) => g.kind === "WITHDRAWAL")?._sum.amountCents ?? 0,
      expensesCents =
        groups.find((g) => g.kind === "EXPENSE")?._sum.amountCents ?? 0;
    const movements = await tx.cashMovement.findMany({
      where: { shiftId: id },
      take: 200,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        kind: true,
        amountCents: true,
        reason: true,
        actorName: true,
        createdAt: true,
      },
    });
    const shift = await tx.cashShift.findUniqueOrThrow({ where: { id } });
    const expectedCents =
      shift.openingCents + cashCents - withdrawalsCents - expensesCents;
    if (
      ![
        cashCents,
        cardCents,
        withdrawalsCents,
        expensesCents,
        expectedCents,
        cashCents + cardCents,
      ].every(Number.isSafeInteger)
    )
      throw new BadRequestException("Importes fuera del límite");
    return {
      cashCents,
      cardCents,
      totalCents: cashCents + cardCents,
      paymentCount: payments.reduce((n, p) => n + p._count._all, 0),
      mixedCount: mixed?._count._all ?? 0,
      withdrawalsCents,
      expensesCents,
      expectedCents,
      movementCount: groups.reduce((n, g) => n + g._count._all, 0),
      detailLimit: 200,
      movements: movements.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }
  list(member: Membership, branchId: string) {
    return this.db.$transaction(
      async (tx) => {
        await this.scope(tx, member, branchId);
        const shifts = await tx.cashShift.findMany({
          where: {
            branchId,
            restaurantId: member.restaurantId,
            closedAt: { not: null },
          },
          orderBy: [{ openedAt: "desc" }, { id: "desc" }],
          take: 50,
          select,
        });
        const active = await tx.cashShift.findFirst({
          where: {
            branchId,
            restaurantId: member.restaurantId,
            closedAt: null,
          },
          select,
        });
        return {
          active: active
            ? { ...active, summary: await this.summary(tx, active.id) }
            : null,
          history: shifts.filter((s) => s.closedAt !== null),
          historyLimit: 50,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  open(actor: Membership, branchId: string, dto: OpenShiftDto) {
    const fingerprint = hash({ openingCents: dto.openingCents });
    return this.write(actor, branchId, async (tx, member, name) => {
      const old = await tx.cashShift.findUnique({
        where: { branchId_requestId: { branchId, requestId: dto.requestId } },
      });
      if (old) {
        if (old.requestHash !== fingerprint)
          throw new ConflictException(
            "La referencia corresponde a otra apertura",
          );
        return tx.cashShift.findUniqueOrThrow({
          where: { id: old.id },
          select,
        });
      }
      const branch = await this.scope(tx, member, branchId);
      if (!branch.active)
        throw new BadRequestException("La sucursal está inactiva");
      if (await tx.cashShift.findFirst({ where: { branchId, closedAt: null } }))
        throw new ConflictException("Ya hay un turno abierto en esta sucursal");
      return tx.cashShift.create({
        data: {
          branchId,
          restaurantId: member.restaurantId,
          openingCents: dto.openingCents,
          openedByName: name,
          requestId: dto.requestId,
          requestHash: fingerprint,
        },
        select,
      });
    });
  }
  movement(actor: Membership, branchId: string, id: string, dto: MovementDto) {
    const fingerprint = hash({
      id,
      kind: dto.kind,
      amountCents: dto.amountCents,
      reason: dto.reason,
      expectedRevision: dto.expectedRevision,
    });
    return this.write(actor, branchId, async (tx, member, name) => {
      const old = await tx.cashMovement.findUnique({
        where: { branchId_requestId: { branchId, requestId: dto.requestId } },
      });
      if (old) {
        if (old.requestHash !== fingerprint || old.shiftId !== id)
          throw new ConflictException(
            "La referencia corresponde a otro movimiento",
          );
        return { id: old.id };
      }
      const shift = await tx.cashShift.findFirst({
        where: { id, branchId, restaurantId: member.restaurantId },
      });
      if (!shift) throw new NotFoundException("Turno no encontrado");
      if (shift.closedAt)
        throw new ConflictException("El turno ya está cerrado");
      if (shift.revision !== dto.expectedRevision)
        throw new ConflictException(
          "La caja cambió; actualiza antes de registrar el movimiento",
        );
      const summary = await this.summary(tx, id);
      if (dto.amountCents > summary.expectedCents)
        throw new ConflictException(
          "El movimiento excede el efectivo esperado disponible",
        );
      const movement = await tx.cashMovement.create({
        data: {
          shiftId: id,
          branchId,
          restaurantId: member.restaurantId,
          kind: dto.kind,
          amountCents: dto.amountCents,
          reason: dto.reason,
          actorName: name,
          requestId: dto.requestId,
          requestHash: fingerprint,
        },
        select: { id: true },
      });
      await tx.cashShift.update({
        where: { id },
        data: { revision: { increment: 1 } },
      });
      return movement;
    });
  }
  close(actor: Membership, branchId: string, id: string, dto: CloseShiftDto) {
    const fingerprint = hash({
      id,
      countedCents: dto.countedCents,
      notes: dto.notes,
      expectedRevision: dto.expectedRevision,
    });
    return this.write(actor, branchId, async (tx, member, name) => {
      const old = await tx.cashShift.findUnique({
        where: {
          branchId_closeRequestId: { branchId, closeRequestId: dto.requestId },
        },
      });
      if (old) {
        if (old.id !== id || old.closeRequestHash !== fingerprint)
          throw new ConflictException(
            "La referencia corresponde a otro cierre",
          );
        return tx.cashShift.findUniqueOrThrow({ where: { id }, select });
      }
      const shift = await tx.cashShift.findFirst({
        where: { id, branchId, restaurantId: member.restaurantId },
      });
      if (!shift) throw new NotFoundException("Turno no encontrado");
      if (shift.closedAt)
        throw new ConflictException("El turno ya está cerrado");
      if (shift.revision !== dto.expectedRevision)
        throw new ConflictException(
          "La caja cambió; actualiza antes de cerrar",
        );
      const summary = await this.summary(tx, id);
      return tx.cashShift.update({
        where: { id },
        data: {
          closedAt: new Date(),
          closedByName: name,
          countedCents: dto.countedCents,
          closeRequestId: dto.requestId,
          closeRequestHash: fingerprint,
          notes: dto.notes,
          revision: { increment: 1 },
          snapshot: {
            ...summary,
            differenceCents: dto.countedCents - summary.expectedCents,
          } as Prisma.InputJsonValue,
        },
        select,
      });
    });
  }
}
