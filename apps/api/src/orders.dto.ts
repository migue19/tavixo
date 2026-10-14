import { Type, Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { OrderStatus } from "@prisma/client";
const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
export class OrderLineDto {
  @IsUUID("4") productId!: string;
  @IsInt() @Min(1) @Max(100) quantity!: number;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @Length(0, 300)
  notes?: string;
}
export class CreateOrderDto {
  @IsUUID("4") requestId!: string;
  @IsUUID("4") tableId!: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @Length(0, 500)
  notes?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items!: OrderLineDto[];
}
export class OrderStatusDto {
  @IsEnum(OrderStatus) status!: OrderStatus;
  @IsEnum(OrderStatus) expectedStatus!: OrderStatus;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @Length(0, 500)
  reason?: string;
}
