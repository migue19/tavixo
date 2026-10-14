import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Membership, Role } from "@prisma/client";
import { Request } from "express";
import { PrismaService } from "./prisma.service";
export type TenantRequest = Request & { member: Membership };
export const Roles = (...roles: Role[]) => SetMetadata("roles", roles);
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private db: PrismaService,
    private reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<TenantRequest>();
    const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!bearer) throw new UnauthorizedException();
    let claims: {
      sub: string;
      tenantId: string;
      membershipId: string;
      sid: string;
      type: string;
    };
    try {
      claims = await this.jwt.verifyAsync(bearer);
    } catch {
      throw new UnauthorizedException();
    }
    if (
      claims.type !== "access" ||
      ![claims.sub, claims.tenantId, claims.membershipId, claims.sid].every(
        (v) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v),
      )
    )
      throw new UnauthorizedException();
    const member = await this.db.membership.findFirst({
      where: {
        id: claims.membershipId,
        userId: claims.sub,
        restaurantId: claims.tenantId,
        active: true,
        user: { active: true },
        restaurant: { active: true },
      },
    });
    const session = await this.db.refreshSession.findFirst({
      where: {
        id: claims.sid,
        membershipId: claims.membershipId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!member || !session) throw new UnauthorizedException();
    if (
      member.branchId &&
      ![Role.OWNER, Role.MANAGER].includes(member.role as "OWNER" | "MANAGER")
    ) {
      const branch = await this.db.branch.findFirst({
        where: {
          id: member.branchId,
          restaurantId: member.restaurantId,
          active: true,
        },
      });
      if (!branch) throw new UnauthorizedException();
    }
    req.member = member;
    // Tenant is derived only from verified JWT + current DB membership, never a client header.
    const roles = this.reflector.getAllAndOverride<Role[]>("roles", [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && !roles.includes(member.role))
      throw new ForbiddenException("Rol sin permiso");
    return true;
  }
}
