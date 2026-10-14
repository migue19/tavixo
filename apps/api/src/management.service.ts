import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Membership, Prisma, Role } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import {
  CreateBranchDto,
  UpdateBranchDto,
  CreateMemberDto,
  UpdateMemberDto,
  CreateRestaurantDto,
  ChangePasswordDto,
} from "./dto";
import { hashPassword, verifyPassword } from "./password";
export const memberSelect = {
  id: true,
  role: true,
  active: true,
  branchId: true,
  branch: { select: { id: true, name: true, active: true } },
  user: { select: { id: true, name: true, email: true } },
} as const;
@Injectable()
export class ManagementService {
  constructor(private db: PrismaService) {}
  private async transaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.db.$transaction(operation);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException(
          "Ya existe ese correo, nombre o identificador",
        );
      throw error;
    }
  }
  // Serialize administrative changes within each tenant and reload actor privileges.
  private async authorize(tx: Prisma.TransactionClient, actor: Membership) {
    await tx.$queryRaw`SELECT id FROM "Restaurant" WHERE id = ${actor.restaurantId}::uuid FOR UPDATE`;
    const current = await tx.membership.findFirst({
      where: {
        id: actor.id,
        restaurantId: actor.restaurantId,
        active: true,
        user: { active: true },
        restaurant: { active: true },
      },
    });
    if (
      !current ||
      ![Role.OWNER, Role.MANAGER].includes(current.role as "OWNER" | "MANAGER")
    )
      throw new ForbiddenException();
    return current;
  }
  private rolePermission(actor: Membership, role: Role) {
    if (
      role === Role.OWNER ||
      (actor.role !== Role.OWNER && role === Role.MANAGER)
    )
      throw new ForbiddenException(
        "Sólo el propietario administra gerentes; el propietario no se modifica desde el equipo",
      );
  }
  async restaurants(userId: string) {
    return this.db.membership.findMany({
      where: { userId, active: true, restaurant: { active: true } },
      select: {
        role: true,
        restaurant: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { restaurant: { name: "asc" } },
    });
  }
  createRestaurant(actor: Membership, dto: CreateRestaurantDto) {
    return this.transaction(async (tx) => {
      const current = await this.authorize(tx, actor);
      if (current.role !== Role.OWNER) throw new ForbiddenException();
      const restaurant = await tx.restaurant.create({
        data: { name: dto.name.trim(), slug: dto.slug },
      });
      const branch = await tx.branch.create({
        data: { restaurantId: restaurant.id, name: "Sucursal Principal" },
      });
      await tx.membership.create({
        data: {
          userId: current.userId,
          restaurantId: restaurant.id,
          branchId: branch.id,
          role: Role.OWNER,
        },
      });
      return {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
      };
    });
  }
  branches(actor: Membership) {
    const administrative =
      actor.role === Role.OWNER || actor.role === Role.MANAGER;
    return this.db.branch.findMany({
      where: {
        restaurantId: actor.restaurantId,
        ...(administrative
          ? {}
          : {
              id: actor.branchId ?? "00000000-0000-0000-0000-000000000000",
              active: true,
            }),
      },
      orderBy: { createdAt: "asc" },
    });
  }
  createBranch(actor: Membership, dto: CreateBranchDto) {
    return this.transaction(async (tx) => {
      await this.authorize(tx, actor);
      return tx.branch.create({
        data: {
          restaurantId: actor.restaurantId,
          name: dto.name,
          address: dto.address ?? "",
        },
      });
    });
  }
  updateBranch(actor: Membership, id: string, dto: UpdateBranchDto) {
    return this.transaction(async (tx) => {
      await this.authorize(tx, actor);
      const branch = await tx.branch.findFirst({
        where: { id, restaurantId: actor.restaurantId },
      });
      if (!branch) throw new NotFoundException("Sucursal no encontrada");
      if (dto.active === false) {
        const count = await tx.branch.count({
          where: {
            restaurantId: actor.restaurantId,
            active: true,
            id: { not: id },
          },
        });
        if (!count)
          throw new BadRequestException(
            "Debe quedar al menos una sucursal activa",
          );
        const members = await tx.membership.findMany({
          where: {
            restaurantId: actor.restaurantId,
            branchId: id,
            role: { notIn: [Role.OWNER, Role.MANAGER] },
          },
          select: { id: true },
        });
        await tx.refreshSession.updateMany({
          where: {
            membershipId: { in: members.map((m) => m.id) },
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
      }
      return tx.branch.update({ where: { id }, data: dto });
    });
  }
  members(actor: Membership) {
    return this.db.membership.findMany({
      where: { restaurantId: actor.restaurantId },
      select: memberSelect,
      orderBy: { user: { name: "asc" } },
    });
  }
  createMember(actor: Membership, dto: CreateMemberDto) {
    return this.transaction(async (tx) => {
      const current = await this.authorize(tx, actor);
      this.rolePermission(current, dto.role);
      const branch = await tx.branch.findFirst({
        where: {
          id: dto.branchId,
          restaurantId: actor.restaurantId,
          active: true,
        },
      });
      if (!branch)
        throw new BadRequestException(
          "Selecciona una sucursal activa del restaurante",
        );
      // Existing global identities require an invitation/consent flow, never overwrite their password.
      const user = await tx.user.create({
        data: {
          email: dto.email.trim().toLowerCase(),
          name: dto.name.trim(),
          passwordHash: await hashPassword(dto.password),
        },
      });
      return tx.membership.create({
        data: {
          userId: user.id,
          restaurantId: actor.restaurantId,
          branchId: branch.id,
          role: dto.role,
        },
        select: memberSelect,
      });
    });
  }
  updateMember(actor: Membership, id: string, dto: UpdateMemberDto) {
    return this.transaction(async (tx) => {
      const current = await this.authorize(tx, actor);
      const target = await tx.membership.findFirst({
        where: { id, restaurantId: actor.restaurantId },
      });
      if (!target) throw new NotFoundException("Empleado no encontrado");
      if (id === actor.id)
        throw new BadRequestException("No puedes cambiar tus propios permisos");
      this.rolePermission(current, target.role);
      if (dto.role) this.rolePermission(current, dto.role);
      if (dto.branchId) {
        const branch = await tx.branch.findFirst({
          where: {
            id: dto.branchId,
            restaurantId: actor.restaurantId,
            active: true,
          },
        });
        if (!branch)
          throw new BadRequestException(
            "Selecciona una sucursal activa del restaurante",
          );
      }
      if (dto.active === true && target.branchId && !dto.branchId) {
        const branch = await tx.branch.findUnique({
          where: { id: target.branchId },
        });
        if (!branch?.active)
          throw new BadRequestException(
            "Selecciona una sucursal activa antes de reactivar al empleado",
          );
      }
      const updated = await tx.membership.update({
        where: { id },
        data: dto,
        select: memberSelect,
      });
      await tx.refreshSession.updateMany({
        where: { membershipId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return updated;
    });
  }
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!(await verifyPassword(dto.currentPassword, user.passwordHash)))
      throw new UnauthorizedException("Contraseña actual incorrecta");
    if (dto.currentPassword === dto.newPassword)
      throw new BadRequestException("Elige una contraseña nueva");
    const hash = await hashPassword(dto.newPassword);
    await this.db.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: { id: userId, passwordHash: user.passwordHash },
        data: { passwordHash: hash },
      });
      if (!changed.count)
        throw new ConflictException(
          "La contraseña cambió; vuelve a iniciar sesión",
        );
      await tx.refreshSession.updateMany({
        where: { membership: { userId }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return { ok: true };
  }
}
