import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard, Roles, TenantRequest } from './auth.guard';
import { PrismaService } from './prisma.service';
import { UpdateRestaurantDto } from './dto';
@Controller() @UseGuards(AuthGuard)
export class RestaurantController {
  constructor(private db: PrismaService) {}
  @Get('me')
  async me(@Req() req: TenantRequest) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: req.member.userId }, select: { id: true, email: true, name: true } });
    return { ...user, role: req.member.role, restaurantId: req.member.restaurantId };
  }
  @Get('restaurant')
  restaurant(@Req() req: TenantRequest) {
    return this.db.restaurant.findUniqueOrThrow({ where: { id: req.member.restaurantId }, select: { id: true, name: true, slug: true, createdAt: true } });
  }
  @Patch('restaurant') @Roles(Role.OWNER, Role.MANAGER)
  update(@Req() req: TenantRequest, @Body() dto: UpdateRestaurantDto) {
    return this.db.restaurant.update({ where: { id: req.member.restaurantId }, data: { name: dto.name }, select: { id: true, name: true, slug: true } });
  }
  @Get('restaurant/members') @Roles(Role.OWNER, Role.MANAGER)
  members(@Req() req: TenantRequest) {
    return this.db.membership.findMany({ where: { restaurantId: req.member.restaurantId, active: true }, select: { id: true, role: true, user: { select: { id: true, name: true, email: true } } }, orderBy: { id: 'asc' } });
  }
}
