import { Transform } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from "class-validator";
import { CashMovementKind } from "@prisma/client";
export class OpenShiftDto {
  @IsUUID("4") requestId!: string;
  @IsInt() @Min(0) @Max(2147483647) openingCents!: number;
}
export class MovementDto {
  @IsUUID("4") requestId!: string;
  @IsEnum(CashMovementKind) kind!: CashMovementKind;
  @IsInt() @Min(1) @Max(2147483647) amountCents!: number;
  @IsInt() @Min(0) @Max(2147483647) expectedRevision!: number;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @Length(1, 500)
  reason!: string;
}
export class CloseShiftDto {
  @IsUUID("4") requestId!: string;
  @IsInt() @Min(0) @Max(2147483647) countedCents!: number;
  @IsInt() @Min(0) @Max(2147483647) expectedRevision!: number;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @Length(0, 500)
  notes!: string;
}
