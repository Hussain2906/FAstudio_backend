import { IsBoolean, IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class UpdateSectionDto {
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
