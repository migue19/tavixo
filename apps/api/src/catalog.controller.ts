import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { AuthGuard, Roles, TenantRequest } from "./auth.guard";
import { CatalogService } from "./catalog.service";
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateProductDto,
  UpdateProductDto,
  CreateTableDto,
  UpdateTableDto,
} from "./catalog.dto";
const uuid = () => new ParseUUIDPipe({ version: "4" });
@Controller("restaurant/branches/:branchId")
@UseGuards(AuthGuard)
export class CatalogController {
  constructor(private catalog: CatalogService) {}
  @Get("categories") categories(
    @Req() req: TenantRequest,
    @Param("branchId", uuid()) branch: string,
  ) {
    return this.catalog.categories(req.member, branch);
  }
  @Post("categories")
  @Roles(Role.OWNER, Role.MANAGER)
  createCategory(
    @Req() req: TenantRequest,
    @Param("branchId", uuid()) branch: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.catalog.createCategory(req.member, branch, dto);
  }
  @Patch("categories/:id")
  @Roles(Role.OWNER, Role.MANAGER)
  updateCategory(
    @Req() req: TenantRequest,
    @Param("branchId", uuid()) branch: string,
    @Param("id", uuid()) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.catalog.updateCategory(req.member, branch, id, dto);
  }
  @Get("products") products(
    @Req() req: TenantRequest,
    @Param("branchId", uuid()) branch: string,
  ) {
    return this.catalog.products(req.member, branch);
  }
  @Post("products")
  @Roles(Role.OWNER, Role.MANAGER)
  createProduct(
    @Req() req: TenantRequest,
    @Param("branchId", uuid()) branch: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.catalog.createProduct(req.member, branch, dto);
  }
  @Patch("products/:id")
  @Roles(Role.OWNER, Role.MANAGER)
  updateProduct(
    @Req() req: TenantRequest,
    @Param("branchId", uuid()) branch: string,
    @Param("id", uuid()) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(req.member, branch, id, dto);
  }
  @Get("tables") tables(
    @Req() req: TenantRequest,
    @Param("branchId", uuid()) branch: string,
  ) {
    return this.catalog.tables(req.member, branch);
  }
  @Post("tables")
  @Roles(Role.OWNER, Role.MANAGER)
  createTable(
    @Req() req: TenantRequest,
    @Param("branchId", uuid()) branch: string,
    @Body() dto: CreateTableDto,
  ) {
    return this.catalog.createTable(req.member, branch, dto);
  }
  @Patch("tables/:id")
  @Roles(Role.OWNER, Role.MANAGER)
  updateTable(
    @Req() req: TenantRequest,
    @Param("branchId", uuid()) branch: string,
    @Param("id", uuid()) id: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.catalog.updateTable(req.member, branch, id, dto);
  }
}
