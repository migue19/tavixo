import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Membership, Prisma, Role } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateProductDto,
  UpdateProductDto,
  CreateTableDto,
  UpdateTableDto,
} from "./catalog.dto";
const productInclude = {
  category: { select: { id: true, name: true, active: true } },
} as const;
@Injectable()
export class CatalogService {
  constructor(private db: PrismaService) {}
  private admin(member: Membership) {
    return member.role === Role.OWNER || member.role === Role.MANAGER;
  }
  private async branch(
    db: Prisma.TransactionClient,
    member: Membership,
    branchId: string,
    write = false,
  ) {
    if (!this.admin(member) && member.branchId !== branchId)
      throw new ForbiddenException(
        "Sólo puedes consultar tu sucursal asignada",
      );
    const branch = await db.branch.findFirst({
      where: { id: branchId, restaurantId: member.restaurantId },
    });
    if (!branch) throw new NotFoundException("Sucursal no encontrada");
    if (!branch.active && (write || !this.admin(member)))
      throw new BadRequestException("La sucursal está inactiva");
    return branch;
  }
  private async write<T>(
    actor: Membership,
    branchId: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    try {
      return await this.db.$transaction(async (tx) => {
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
        if (!current || !this.admin(current)) throw new ForbiddenException();
        await this.branch(tx, current, branchId, true);
        return operation(tx);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException("Ya existe ese nombre en la sucursal");
      throw error;
    }
  }
  async categories(member: Membership, branchId: string) {
    await this.branch(this.db, member, branchId);
    return this.db.menuCategory.findMany({
      where: {
        restaurantId: member.restaurantId,
        branchId,
        ...(this.admin(member) ? {} : { active: true }),
      },
      orderBy: { name: "asc" },
    });
  }
  createCategory(member: Membership, branchId: string, dto: CreateCategoryDto) {
    return this.write(member, branchId, (tx) =>
      tx.menuCategory.create({
        data: { restaurantId: member.restaurantId, branchId, name: dto.name },
      }),
    );
  }
  updateCategory(
    member: Membership,
    branchId: string,
    id: string,
    dto: UpdateCategoryDto,
  ) {
    return this.write(member, branchId, async (tx) => {
      const category = await tx.menuCategory.findFirst({
        where: { id, restaurantId: member.restaurantId, branchId },
      });
      if (!category) throw new NotFoundException("Categoría no encontrada");
      return tx.menuCategory.update({ where: { id }, data: dto });
    });
  }
  async products(member: Membership, branchId: string) {
    await this.branch(this.db, member, branchId);
    return this.db.product.findMany({
      where: {
        restaurantId: member.restaurantId,
        branchId,
        ...(this.admin(member)
          ? {}
          : { active: true, category: { active: true } }),
      },
      include: productInclude,
      orderBy: { name: "asc" },
    });
  }
  createProduct(member: Membership, branchId: string, dto: CreateProductDto) {
    return this.write(member, branchId, async (tx) => {
      const category = await tx.menuCategory.findFirst({
        where: {
          id: dto.categoryId,
          restaurantId: member.restaurantId,
          branchId,
          active: true,
        },
      });
      if (!category)
        throw new BadRequestException(
          "Selecciona una categoría activa de esta sucursal",
        );
      return tx.product.create({
        data: { ...dto, restaurantId: member.restaurantId, branchId },
        include: productInclude,
      });
    });
  }
  updateProduct(
    member: Membership,
    branchId: string,
    id: string,
    dto: UpdateProductDto,
  ) {
    return this.write(member, branchId, async (tx) => {
      const product = await tx.product.findFirst({
        where: { id, restaurantId: member.restaurantId, branchId },
      });
      if (!product) throw new NotFoundException("Producto no encontrado");
      if (dto.categoryId || dto.active === true) {
        const category = await tx.menuCategory.findFirst({
          where: {
            id: dto.categoryId ?? product.categoryId,
            restaurantId: member.restaurantId,
            branchId,
            active: true,
          },
        });
        if (!category)
          throw new BadRequestException(
            "Selecciona una categoría activa de esta sucursal",
          );
      }
      return tx.product.update({
        where: { id },
        data: dto,
        include: productInclude,
      });
    });
  }
  async tables(member: Membership, branchId: string) {
    await this.branch(this.db, member, branchId);
    return this.db.diningTable.findMany({
      where: {
        restaurantId: member.restaurantId,
        branchId,
        ...(this.admin(member) ? {} : { active: true }),
      },
      orderBy: { name: "asc" },
    });
  }
  createTable(member: Membership, branchId: string, dto: CreateTableDto) {
    return this.write(member, branchId, (tx) =>
      tx.diningTable.create({
        data: { ...dto, restaurantId: member.restaurantId, branchId },
      }),
    );
  }
  updateTable(
    member: Membership,
    branchId: string,
    id: string,
    dto: UpdateTableDto,
  ) {
    return this.write(member, branchId, async (tx) => {
      const table = await tx.diningTable.findFirst({
        where: { id, restaurantId: member.restaurantId, branchId },
      });
      if (!table) throw new NotFoundException("Mesa no encontrada");
      return tx.diningTable.update({ where: { id }, data: dto });
    });
  }
}
