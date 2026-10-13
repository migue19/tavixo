import { IsEmail, IsString, Length, Matches } from 'class-validator';
export class LoginDto {
  @IsEmail() @Length(3, 254) email!: string;
  @IsString() @Length(1, 128) password!: string;
  @IsString() @Length(1, 80) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) restaurantSlug!: string;
}
export class UpdateRestaurantDto {
  @IsString() @Length(2, 120) name!: string;
}
