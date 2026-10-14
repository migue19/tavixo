import { Transform } from "class-transformer";
import {
  IsInt,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from "class-validator";
export class CashQuery {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) day!: string;
}
export class CreateCashCutDto extends CashQuery {
  @IsUUID("4") requestId!: string;
  @IsInt() @Min(0) @Max(2147483647) openingCents!: number;
  @IsInt() @Min(0) @Max(2147483647) countedCents!: number;
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) expectedTotalCents!: number;
  @IsInt() @Min(0) @Max(2147483647) expectedPaymentCount!: number;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @Length(0, 500)
  notes?: string;
}
