import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const smtpHostnamePattern = /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))+$/;

function trimText({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateContactSettingsDto {
  @Transform(trimText)
  @IsString()
  @MaxLength(253)
  @Matches(smtpHostnamePattern, { message: 'smtpHost must be a public SMTP hostname, not a URL or IP address.' })
  smtpHost!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort!: number;

  @IsBoolean()
  smtpSecure!: boolean;

  @Transform(trimText)
  @IsString()
  @MaxLength(253)
  smtpUsername!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  smtpPassword?: string;

  @IsBoolean()
  clearSmtpPassword!: boolean;

  @Transform(trimText)
  @IsString()
  @MaxLength(100)
  fromName!: string;

  @Transform(trimText)
  @IsEmail()
  @MaxLength(254)
  fromEmail!: string;

  @Transform(trimText)
  @IsEmail()
  @MaxLength(254)
  recipientEmail!: string;
}
