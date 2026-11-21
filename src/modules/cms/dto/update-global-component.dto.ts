import type { FooterContent, SiteLogoContent } from '@fs/cms-contracts';
import { IsObject } from 'class-validator';

export class UpdateGlobalComponentDto {
  @IsObject()
  content!: SiteLogoContent | FooterContent;
}
