import { Role } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsString,
  Length,
  Matches,
  IsBoolean,
  IsEnum,
  ValidateIf,
  IsUUID,
} from "class-validator";
export class LoginDto {
  @IsEmail() @Length(3, 254) email!: string;
  @IsString() @Length(1, 128) password!: string;
  @IsString()
  @Length(1, 80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  restaurantSlug!: string;
}
export class UpdateRestaurantDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 120)
  name!: string;
}

export class CreateRestaurantDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 120)
  name!: string;
  @IsString()
  @Length(2, 80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
}
export class SwitchRestaurantDto {
  @IsUUID("4") restaurantId!: string;
}
export class CreateBranchDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 120)
  name!: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(0, 300)
  address?: string;
}
export class UpdateBranchDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 120)
  name?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(0, 300)
  address?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
export class CreateMemberDto {
  @IsEmail() @Length(3, 254) email!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 120)
  name!: string;
  @IsString() @Length(12, 128) password!: string;
  @IsEnum(Role) role!: Role;
  @IsUUID("4") branchId!: string;
}
export class UpdateMemberDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(Role)
  role?: Role;
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID("4")
  branchId?: string;
}
export class ChangePasswordDto {
  @IsString() @Length(1, 128) currentPassword!: string;
  @IsString() @Length(12, 128) newPassword!: string;
}
