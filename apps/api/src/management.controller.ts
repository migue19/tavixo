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
import { ManagementService } from "./management.service";
import {
  CreateBranchDto,
  UpdateBranchDto,
  CreateMemberDto,
  UpdateMemberDto,
  CreateRestaurantDto,
  ChangePasswordDto,
} from "./dto";
@Controller()
@UseGuards(AuthGuard)
export class ManagementController {
  constructor(private management: ManagementService) {}
  @Get("restaurants") restaurants(@Req() req: TenantRequest) {
    return this.management.restaurants(req.member.userId);
  }
  @Post("restaurants")
  @Roles(Role.OWNER)
  createRestaurant(
    @Req() req: TenantRequest,
    @Body() dto: CreateRestaurantDto,
  ) {
    return this.management.createRestaurant(req.member, dto);
  }
  @Get("restaurant/branches") branches(@Req() req: TenantRequest) {
    return this.management.branches(req.member);
  }
  @Post("restaurant/branches")
  @Roles(Role.OWNER, Role.MANAGER)
  createBranch(@Req() req: TenantRequest, @Body() dto: CreateBranchDto) {
    return this.management.createBranch(req.member, dto);
  }
  @Patch("restaurant/branches/:id")
  @Roles(Role.OWNER, Role.MANAGER)
  updateBranch(
    @Req() req: TenantRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.management.updateBranch(req.member, id, dto);
  }
  @Post("restaurant/members")
  @Roles(Role.OWNER, Role.MANAGER)
  createMember(@Req() req: TenantRequest, @Body() dto: CreateMemberDto) {
    return this.management.createMember(req.member, dto);
  }
  @Patch("restaurant/members/:id")
  @Roles(Role.OWNER, Role.MANAGER)
  updateMember(
    @Req() req: TenantRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.management.updateMember(req.member, id, dto);
  }
  @Patch("me/password") changePassword(
    @Req() req: TenantRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.management.changePassword(req.member.userId, dto);
  }
}
