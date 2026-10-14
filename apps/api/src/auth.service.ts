import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { Prisma, Membership, User, Restaurant } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import { verifyPassword, hashPassword } from "./password";
import { LoginDto } from "./dto";
import { config } from "./config";
type Member = Membership & { user: User; restaurant: Restaurant };
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const include = { user: true, restaurant: true } as const;
@Injectable()
export class AuthService {
  private dummyHash = hashPassword(randomBytes(32).toString("hex"));
  constructor(
    private db: PrismaService,
    private jwt: JwtService,
  ) {}
  async login(dto: LoginDto) {
    const member = await this.db.membership.findFirst({
      where: {
        user: { email: dto.email.trim().toLowerCase() },
        restaurant: { slug: dto.restaurantSlug },
      },
      include,
    });
    const valid = await verifyPassword(
      dto.password,
      member?.user.passwordHash ?? (await this.dummyHash),
    );
    if (!member || !valid || !(await this.active(member)))
      throw new UnauthorizedException("Credenciales inválidas");
    return this.db.$transaction(async (tx) => {
      // Serialize login with password changes so a pre-change password cannot mint a later session.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${member.userId}::uuid FOR UPDATE`;
      const current = await tx.membership.findUniqueOrThrow({
        where: { id: member.id },
        include,
      });
      if (
        current.user.passwordHash !== member.user.passwordHash ||
        !(await this.active(current))
      )
        throw new UnauthorizedException("Credenciales inválidas");
      return this.issue(tx, current, randomUUID());
    });
  }
  async switchRestaurant(
    userId: string,
    restaurantId: string,
    oldToken?: string,
  ) {
    const member = await this.db.membership.findFirst({
      where: { userId, restaurantId },
      include,
    });
    if (!member || !(await this.active(member)))
      throw new UnauthorizedException("No tienes acceso a ese restaurante");
    const result = await this.issue(this.db, member, randomUUID());
    await this.logout(oldToken);
    return result;
  }
  private async active(member: Member) {
    if (!(member.active && member.user.active && member.restaurant.active))
      return false;
    if (
      !member.branchId ||
      member.role === "OWNER" ||
      member.role === "MANAGER"
    )
      return true;
    return !!(await this.db.branch.findFirst({
      where: {
        id: member.branchId,
        restaurantId: member.restaurantId,
        active: true,
      },
    }));
  }
  private async issue(
    db: Prisma.TransactionClient,
    member: Member,
    familyId: string,
  ) {
    const token = randomBytes(48).toString("base64url");
    const session = await db.refreshSession.create({
      data: {
        membershipId: member.id,
        tokenHash: digest(token),
        familyId,
        expiresAt: new Date(Date.now() + config().refreshMs),
      },
    });
    const accessToken = await this.jwt.signAsync({
      sub: member.userId,
      tenantId: member.restaurantId,
      membershipId: member.id,
      sid: session.id,
      type: "access",
    });
    return {
      refreshToken: token,
      accessToken,
      expiresIn: config().accessSeconds,
      user: {
        id: member.userId,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
        branchId: member.branchId,
      },
      restaurant: {
        id: member.restaurantId,
        name: member.restaurant.name,
        slug: member.restaurant.slug,
      },
    };
  }
  async refresh(token: string) {
    if (!token || token.length > 256) throw new UnauthorizedException();
    const session = await this.db.refreshSession.findUnique({
      where: { tokenHash: digest(token) },
      include: { membership: { include } },
    });
    if (!session) throw new UnauthorizedException();
    if (
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !(await this.active(session.membership))
    ) {
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException("Sesión expirada o revocada");
    }
    const result = await this.db.$transaction(async (tx) => {
      const claimed = await tx.refreshSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date() },
      });
      if (claimed.count !== 1) return null;
      return this.issue(tx, session.membership, session.familyId);
    });
    if (!result) {
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException("Refresh token reutilizado");
    }
    return result;
  }
  private revokeFamily(familyId: string) {
    return this.db.refreshSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  async logout(token?: string) {
    if (!token || token.length > 256) return;
    const session = await this.db.refreshSession.findUnique({
      where: { tokenHash: digest(token) },
    });
    if (session) await this.revokeFamily(session.familyId);
  }
}
