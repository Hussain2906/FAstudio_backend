import { IsBoolean } from 'class-validator';

export class DeleteSectionDto {
  @IsBoolean()
  confirm!: boolean;
}
