import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { CMS_PUBLISH, CMS_READ, CMS_WRITE, RequirePermissions } from '../auth/permissions.js';
import { CmsService } from './cms.service.js';
import { CreateSectionDto } from './dto/create-section.dto.js';
import { ReorderSectionsDto } from './dto/reorder-sections.dto.js';
import { UpdateSectionDto } from './dto/update-section.dto.js';
import { UpdateGlobalComponentDto } from './dto/update-global-component.dto.js';
import { DeleteSectionDto } from './dto/delete-section.dto.js';

@ApiTags('cms')
@Controller('cms')
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get('public/pages/:slug')
  @ApiOperation({ summary: 'Read published CMS page content' })
  getPublishedPage(@Param('slug') slug: string) {
    return this.cmsService.getPublishedPage(slug);
  }

  @Get('admin/registry')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(CMS_READ)
  @ApiOperation({ summary: 'Read registered CMS section definitions' })
  getRegistry() {
    return this.cmsService.getRegistry();
  }

  @Get('admin/pages/:slug')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(CMS_READ)
  getDraftPage(@Param('slug') slug: string) {
    return this.cmsService.getDraftPage(slug);
  }

  @Get('public/components/:type')
  @ApiOperation({ summary: 'Read a published global CMS component' })
  getPublishedGlobalComponent(@Param('type') type: string) {
    return this.cmsService.getPublishedGlobalComponent(type);
  }

  @Get('admin/components/:type')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(CMS_READ)
  getDraftGlobalComponent(@Param('type') type: string) {
    return this.cmsService.getDraftGlobalComponent(type);
  }

  @Put('admin/components/:type/draft')
  @UseGuards(AuthGuard, CsrfGuard, PermissionsGuard)
  @RequirePermissions(CMS_WRITE)
  updateGlobalComponentDraft(@Param('type') type: string, @Body() dto: UpdateGlobalComponentDto) {
    return this.cmsService.updateGlobalComponentDraft(type, dto);
  }

  @Post('admin/components/:type/publish')
  @UseGuards(AuthGuard, CsrfGuard, PermissionsGuard)
  @RequirePermissions(CMS_PUBLISH)
  publishGlobalComponent(@Param('type') type: string) {
    return this.cmsService.publishGlobalComponent(type);
  }

  @Post('admin/pages/:pageId/sections')
  @UseGuards(AuthGuard, CsrfGuard, PermissionsGuard)
  @RequirePermissions(CMS_WRITE)
  createSection(@Param('pageId') pageId: string, @Body() dto: CreateSectionDto) {
    return this.cmsService.createSection(pageId, dto);
  }

  @Patch('admin/sections/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionsGuard)
  @RequirePermissions(CMS_WRITE)
  updateSection(@Param('id') id: string, @Body() dto: UpdateSectionDto) {
    return this.cmsService.updateSection(id, dto);
  }

  @Put('admin/pages/:pageId/sections/order')
  @UseGuards(AuthGuard, CsrfGuard, PermissionsGuard)
  @RequirePermissions(CMS_WRITE)
  reorderSections(@Param('pageId') pageId: string, @Body() dto: ReorderSectionsDto) {
    return this.cmsService.reorderSections(pageId, dto);
  }

  @Delete('admin/sections/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionsGuard)
  @RequirePermissions(CMS_WRITE)
  deletePortfolioProjectSection(@Param('id') id: string, @Body() dto: DeleteSectionDto) {
    return this.cmsService.deletePortfolioProjectSection(id, dto);
  }

  @Put('admin/pages/:pageId/sections/publish-order')
  @UseGuards(AuthGuard, CsrfGuard, PermissionsGuard)
  @RequirePermissions(CMS_PUBLISH)
  publishPortfolioOrder(@Param('pageId') pageId: string, @Body() dto: ReorderSectionsDto) {
    return this.cmsService.publishPortfolioOrder(pageId, dto);
  }

  @Post('admin/sections/:id/publish')
  @UseGuards(AuthGuard, CsrfGuard, PermissionsGuard)
  @RequirePermissions(CMS_PUBLISH)
  publishSection(@Param('id') id: string) {
    return this.cmsService.publishSection(id);
  }
}
