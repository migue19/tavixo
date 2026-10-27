import { Throttle } from "@nestjs/throttler";
import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsIn, Matches } from "class-validator";
import sharp from "sharp";
import { AuthGuard, Roles, TenantRequest } from "./auth.guard";
import { Role, Restaurant } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import { brandingDefaults, brightness, contrast, restaurantBranding } from "./branding";
export class BrandingDto {
  @Matches(/^#[a-f0-9]{6}$/i) primary!: string;
  @Matches(/^#[a-f0-9]{6}$/i) accent!: string;
  @Matches(/^#[a-f0-9]{6}$/i) surface!: string;
  @IsIn(["keep", "replace", "remove"]) logoAction!: "keep" | "replace" | "remove";
}
const settings = (r: Restaurant) => ({ branding: restaurantBranding(r.slug, r.branding) ?? brandingDefaults(r.slug), defaults: brandingDefaults(r.slug), setupNeeded: !r.branding && !r.brandingPromptDismissed && r.slug !== "birria-el-cachanilla" });
@Controller("restaurant/branding")
@UseGuards(AuthGuard)
@Roles(Role.OWNER, Role.MANAGER)
export class BrandingController {
  constructor(private db: PrismaService) {}
  @Get() async get(@Req() req: TenantRequest) {
    return settings(await this.db.restaurant.findUniqueOrThrow({ where: { id: req.member.restaurantId } }));
  }
  @Post("dismiss") async dismiss(@Req() req: TenantRequest) {
    return settings(await this.db.restaurant.update({ where: { id: req.member.restaurantId }, data: { brandingPromptDismissed: true } }));
  }
  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(FileInterceptor("logo", { limits: { fileSize: 512 * 1024, files: 1, fields: 4, fieldSize: 128, parts: 5 } }))
  async save(@Req() req: TenantRequest, @Body() dto: BrandingDto, @UploadedFile() file?: { buffer: Buffer; mimetype: string }) {
    if (contrast(dto.primary, "#ffffff") < 4.5 || contrast(dto.primary, dto.surface) < 4.5 || brightness(dto.surface) < .7 || contrast(dto.primary, dto.accent) < 3)
      throw new BadRequestException("Usa un color principal oscuro, un fondo claro y un acento que contraste con el principal");
    if ((dto.logoAction === "replace") !== !!file) throw new BadRequestException("Selecciona un logo para reemplazarlo o conserva el actual");
    let uploaded: string | undefined;
    if (file) {
      if (!["image/png", "image/jpeg"].includes(file.mimetype)) throw new BadRequestException("El logo debe ser PNG o JPG");
      try {
        const image = sharp(file.buffer, { limitInputPixels: 2048 * 2048, failOn: "error" });
        const info = await image.metadata();
        if (info.format !== (file.mimetype === "image/png" ? "png" : "jpeg") || (info.pages ?? 1) !== 1 || !info.width || !info.height || Math.min(info.width,info.height) < 128 || Math.max(info.width,info.height) > 2048) throw new Error();
        let output = await image.rotate().resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
        // Detailed JPEGs can grow when converted to true-colour PNG. Quantize only
        // when needed, retaining transparency and the existing storage ceiling.
        if (output.length > 256 * 1024) output = await sharp(output).png({ palette: true, colours: 256, compressionLevel: 9, effort: 7 }).toBuffer();
        if (output.length > 256 * 1024) output = await sharp(output).resize({ width: 384, height: 384, fit: "inside", withoutEnlargement: true }).png({ palette: true, colours: 128, compressionLevel: 9 }).toBuffer();
        if (output.length > 256 * 1024) throw new Error();
        uploaded = "data:image/png;base64," + output.toString("base64");
      } catch { throw new BadRequestException("Logo inválido: usa PNG/JPG de 128 a 2048 px por lado y hasta 512 KB; simplifica la imagen si no puede optimizarse"); }
    }
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Restaurant" WHERE id = ${req.member.restaurantId}::uuid FOR UPDATE`;
      const member = await tx.membership.findFirst({ where: { id: req.member.id, active: true, role: { in: [Role.OWNER,Role.MANAGER] }, user: { active: true }, restaurant: { active: true } } });
      if (!member) throw new ForbiddenException();
      const current = await tx.restaurant.findUniqueOrThrow({ where: { id: req.member.restaurantId } });
      const prior = restaurantBranding(current.slug, current.branding) ?? brandingDefaults(current.slug);
      const branding = { primary: dto.primary.toLowerCase(), accent: dto.accent.toLowerCase(), surface: dto.surface.toLowerCase(), logo: dto.logoAction === "remove" ? null : uploaded ?? prior.logo };
      return settings(await tx.restaurant.update({ where: { id: current.id }, data: { branding, brandingPromptDismissed: true } }));
    });
  }
}
