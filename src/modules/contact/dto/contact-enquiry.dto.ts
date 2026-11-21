import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

function trimText({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class ContactEnquiryDto {
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @Transform(trimText)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(80)
  projectType?: string;

  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
