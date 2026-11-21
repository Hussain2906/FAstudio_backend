import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateSectionDto {
  @IsString()
  type!: string;

  @IsObject()
  content!: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
