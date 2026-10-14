import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
} from "class-validator";
const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
export class CreateCategoryDto {
  @Transform(trim) @IsString() @Length(2, 80) name!: string;
}
export class UpdateCategoryDto {
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() active?: boolean;
}
export class CreateProductDto {
  @Transform(trim) @IsString() @Length(2, 120) name!: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Length(0, 500)
  description?: string;
  @IsUUID("4") categoryId!: string;
  @IsInt() @Min(0) @Max(99999999) priceCents!: number;
}
export class UpdateProductDto {
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  name?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Length(0, 500)
  description?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID("4") categoryId?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsInt()
  @Min(0)
  @Max(99999999)
  priceCents?: number;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() active?: boolean;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() available?: boolean;
}
export class CreateTableDto {
  @Transform(trim) @IsString() @Length(1, 40) name!: string;
  @IsInt() @Min(1) @Max(100) capacity!: number;
}
export class UpdateTableDto {
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 40)
  name?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsInt()
  @Min(1)
  @Max(100)
  capacity?: number;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() active?: boolean;
}
