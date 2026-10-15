import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Membership, Prisma, Role } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import { cashRange } from "./cash.service";
export function salesRange(from: string, to: string, now = new Date()) {
  const start = cashRange(from, now).start;
  const end = cashRange(to, now).end;
  const days =
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86400000 +
    1;
  if (days < 1 || days > 366)
    throw new BadRequestException("Selecciona de 1 a 366 días, hasta hoy");
  return { start, end, days, generatedAt: now };
}
function safe(value: bigint | Prisma.Decimal) {
  const n = Number(value);
  if (!Number.isSafeInteger(n))
    throw new BadRequestException("Los importes exceden el límite del reporte");
  return n;
}
@Injectable()
export class ReportsService {
  constructor(private db: PrismaService) {}
  sales(member: Membership, branchId: string, from: string, to: string) {
    const range = salesRange(from, to);
    return this.db.$transaction(
      async (tx) => {
        if (
          ![Role.OWNER, Role.MANAGER, Role.CASHIER].includes(
            member.role as "OWNER" | "MANAGER" | "CASHIER",
          ) ||
          (member.role === Role.CASHIER && member.branchId !== branchId)
        )
          throw new ForbiddenException();
        const branch = await tx.branch.findFirst({
          where: { id: branchId, restaurantId: member.restaurantId },
          select: { id: true, name: true },
        });
        if (!branch) throw new NotFoundException("Sucursal no encontrada");
        // Prisma timestamps store UTC without a timezone. Bind ISO strings explicitly
        // to avoid PostgreSQL session timezone coercion of Date parameters.
        const filter = Prisma.sql`p."restaurantId" = ${member.restaurantId}::uuid AND p."branchId" = ${branchId}::uuid AND p."createdAt" >= ${range.start.toISOString()}::timestamp AND p."createdAt" < ${range.end.toISOString()}::timestamp`;
        const rows = await tx.$queryRaw<
          {
            day: string;
            count: bigint;
            total: bigint;
            cash: bigint;
            card: bigint;
            mixed: bigint;
          }[]
        >(Prisma.sql`
        SELECT to_char(p."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD') AS day,
        count(*) AS count, sum(p."amountCents") AS total,
        sum(COALESCE(p."cashAmountCents", CASE WHEN p.method = 'CASH' THEN p."amountCents" ELSE 0 END)) AS cash,
        sum(COALESCE(p."cardAmountCents", CASE WHEN p.method = 'CARD' THEN p."amountCents" ELSE 0 END)) AS card,
        count(*) FILTER (WHERE p.method = 'MIXED') AS mixed FROM "Payment" p WHERE ${filter} GROUP BY day ORDER BY day`);
        const products = await tx.$queryRaw<
          {
            productId: string;
            name: string;
            quantity: bigint;
            total: Prisma.Decimal;
          }[]
        >(Prisma.sql`
        SELECT i."productId", i.name, sum(i.quantity - i."cancelledQuantity") AS quantity,
        sum((i.quantity - i."cancelledQuantity")::bigint * i."unitPriceCents") AS total
        FROM "OrderItem" i JOIN "Payment" p ON p."orderId" = i."orderId" AND p."branchId" = i."branchId" AND p."restaurantId" = i."restaurantId"
        WHERE ${filter} AND i.quantity > i."cancelledQuantity"
        GROUP BY i."productId", i.name ORDER BY quantity DESC, total DESC, i.name, i."productId"`);
        const mapped = new Map(
          rows.map((r) => [
            r.day,
            {
              day: r.day,
              paymentCount: safe(r.count),
              totalCents: safe(r.total),
              cashCents: safe(r.cash),
              cardCents: safe(r.card),
              mixedCount: safe(r.mixed),
            },
          ]),
        );
        const daily = Array.from({ length: range.days }, (_, i) => {
          const day = new Date(Date.parse(`${from}T00:00:00Z`) + i * 86400000)
            .toISOString()
            .slice(0, 10);
          return (
            mapped.get(day) ?? {
              day,
              paymentCount: 0,
              totalCents: 0,
              cashCents: 0,
              cardCents: 0,
              mixedCount: 0,
            }
          );
        });
        const sum = (
          key:
            | "paymentCount"
            | "totalCents"
            | "cashCents"
            | "cardCents"
            | "mixedCount",
        ) => safe(daily.reduce((n, r) => n + BigInt(r[key]), 0n));
        const paymentCount = sum("paymentCount"),
          totalCents = sum("totalCents");
        return {
          from,
          to,
          timezone: "America/Mexico_City",
          branch,
          periodStart: range.start.toISOString(),
          periodEnd: range.end.toISOString(),
          generatedAt: range.generatedAt.toISOString(),
          paymentCount,
          totalCents,
          cashCents: sum("cashCents"),
          cardCents: sum("cardCents"),
          mixedCount: sum("mixedCount"),
          averageTicketCents: paymentCount
            ? Math.round(totalCents / paymentCount)
            : 0,
          unitsSold: safe(products.reduce((n, r) => n + r.quantity, 0n)),
          productSalesCents: safe(
            products.reduce((n, r) => n + BigInt(r.total.toString()), 0n),
          ),
          productCount: products.length,
          productLimit: 50,
          daily,
          products: products.slice(0, 50).map((r) => ({
            productId: r.productId,
            name: r.name,
            quantity: safe(r.quantity),
            totalCents: safe(r.total),
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
