import { Injectable, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { getFooterContentIssues, getGlobalComponentDefinition, getSectionDefinition, normalizeFooterContent, GLOBAL_FOOTER_TYPE, PORTFOLIO_PROJECT_TYPE, sectionRegistry, type CmsPublishedPage } from '@fs/cms-contracts';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { CreateSectionDto } from './dto/create-section.dto.js';
import type { ReorderSectionsDto } from './dto/reorder-sections.dto.js';
import type { UpdateSectionDto } from './dto/update-section.dto.js';
import type { UpdateGlobalComponentDto } from './dto/update-global-component.dto.js';
import type { DeleteSectionDto } from './dto/delete-section.dto.js';

@Injectable()
export class CmsService {
  constructor(private readonly prisma: PrismaService) {}

  getRegistry() {
    return sectionRegistry.map((definition) => {
      const { validate, ...metadata } = definition;
      void validate;
      return metadata;
    });
  }

  async getPublishedPage(slug: string): Promise<CmsPublishedPage> {
    try {
      const page = await this.prisma.cmsPage.findUnique({
        where: { slug },
        include: {
          sections: {
            where: { publishedContent: { not: Prisma.JsonNull } },
            orderBy: { publishedOrder: 'asc' },
            select: {
              id: true,
              type: true,
              publishedContent: true,
              publishedOrder: true,
              publishedIsVisible: true,
            },
          },
        },
      });
      if (!page || !page.publishedAt) throw new NotFoundException('Published CMS page not found.');

      return {
        id: page.id,
        slug: page.slug,
        name: page.name,
        sectionStates: page.sections.flatMap((section) =>
          section.publishedContent === null
            ? []
            : [{ id: section.id, type: section.type, isVisible: section.publishedIsVisible }],
        ),
        sections: page.sections.flatMap((section) => {
          const definition = getSectionDefinition(section.type);
          if (!section.publishedIsVisible || !definition || section.publishedContent === null || section.publishedOrder === null) return [];
          return [{ id: section.id, type: section.type, content: section.publishedContent, order: section.publishedOrder, renderer: definition.renderer }];
        }),
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException('CMS content is unavailable until its database migration is applied.');
    }
  }

  async getDraftPage(slug: string) {
    const page = await this.prisma.cmsPage.findUnique({ where: { slug }, include: { sections: { orderBy: { draftOrder: 'asc' } } } });
    if (!page) throw new NotFoundException('CMS page not found.');
    return page;
  }

  async getPublishedGlobalComponent(type: string) {
    this.assertGlobalComponentType(type);
    const component = await this.prisma.cmsGlobalComponent.findUnique({ where: { type } });
    if (!component?.publishedContent) throw new NotFoundException('Published global component not found.');
    return { type: component.type, content: component.publishedContent };
  }

  async getDraftGlobalComponent(type: string) {
    this.assertGlobalComponentType(type);
    const component = await this.prisma.cmsGlobalComponent.findUnique({ where: { type } });
    if (!component) return { type, draftContent: getGlobalComponentDefinition(type)?.defaultContent, publishedContent: null, publishedAt: null };
    return type === GLOBAL_FOOTER_TYPE
      ? { ...component, draftContent: normalizeFooterContent(component.draftContent) }
      : component;
  }

  async updateGlobalComponentDraft(type: string, dto: UpdateGlobalComponentDto) {
    this.assertGlobalComponentType(type);
    const normalizedContent = type === GLOBAL_FOOTER_TYPE ? normalizeFooterContent(dto.content) : dto.content;
    this.assertGlobalComponentContent(type, normalizedContent, true);
    const content = normalizedContent as Prisma.InputJsonValue;
    const current = await this.prisma.cmsGlobalComponent.findUnique({ where: { type }, select: { id: true } });

    return this.prisma.$transaction(async (tx) => {
      const component = current
        ? await tx.cmsGlobalComponent.update({ where: { id: current.id }, data: { draftContent: content, draftUpdatedAt: new Date() } })
        : await tx.cmsGlobalComponent.create({ data: { type, draftContent: content } });
      const version = ((await tx.cmsGlobalComponentRevision.aggregate({ where: { componentId: component.id }, _max: { version: true } }))._max.version ?? 0) + 1;
      await tx.cmsGlobalComponentRevision.create({ data: { componentId: component.id, version, status: 'DRAFT', content } });
      return component;
    });
  }

  async publishGlobalComponent(type: string) {
    this.assertGlobalComponentType(type);
    const component = await this.prisma.cmsGlobalComponent.findUnique({ where: { type } });
    if (!component) throw new NotFoundException('Global component draft not found.');
    const content = type === GLOBAL_FOOTER_TYPE ? normalizeFooterContent(component.draftContent) : component.draftContent;
    this.assertGlobalComponentContent(type, content);
    const version = ((await this.prisma.cmsGlobalComponentRevision.aggregate({ where: { componentId: component.id }, _max: { version: true } }))._max.version ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const publishedAt = new Date();
      await tx.cmsGlobalComponentRevision.create({ data: { componentId: component.id, version, status: 'PUBLISHED', content: content as Prisma.InputJsonValue } });
      return tx.cmsGlobalComponent.update({ where: { id: component.id }, data: { draftContent: content as Prisma.InputJsonValue, publishedContent: content as Prisma.InputJsonValue, publishedAt } });
    });
  }

  async createSection(pageId: string, dto: CreateSectionDto) {
    this.assertRegisteredContent(dto.type, dto.content, true);
    const page = await this.prisma.cmsPage.findUnique({ where: { id: pageId }, select: { slug: true } });
    const definition = getSectionDefinition(dto.type);
    if (!page || !definition || page.slug !== definition.page) throw new UnprocessableEntityException('The section is not registered for this page.');
    if (dto.type !== PORTFOLIO_PROJECT_TYPE) {
      const existing = await this.prisma.cmsSection.findFirst({ where: { pageId, type: dto.type }, select: { id: true } });
      if (existing) throw new UnprocessableEntityException('This registered section already exists on the page.');
    }
    if (dto.type === PORTFOLIO_PROJECT_TYPE) await this.assertUniquePortfolioSlug(pageId, dto.content, undefined);
    return this.prisma.cmsSection.create({
      data: { pageId, type: dto.type, draftContent: dto.content as Prisma.InputJsonValue, draftOrder: dto.order ?? 0 },
    });
  }

  async updateSection(id: string, dto: UpdateSectionDto) {
    if (dto.content !== undefined) {
      const existing = await this.prisma.cmsSection.findUnique({ where: { id }, select: { type: true, pageId: true } });
      if (!existing) throw new NotFoundException('CMS section not found.');
      this.assertRegisteredContent(existing.type, dto.content, true);
      if (existing.type === PORTFOLIO_PROJECT_TYPE) await this.assertUniquePortfolioSlug(existing.pageId, dto.content, id);
    }
    return this.prisma.cmsSection.update({
      where: { id },
      data: { ...(dto.content ? { draftContent: dto.content as Prisma.InputJsonValue, draftUpdatedAt: new Date() } : {}), ...(dto.order === undefined ? {} : { draftOrder: dto.order }), ...(dto.isVisible === undefined ? {} : { draftIsVisible: dto.isVisible }) },
    });
  }

  async publishSection(id: string) {
    const section = await this.prisma.cmsSection.findUnique({ where: { id }, include: { page: true } });
    if (!section) throw new NotFoundException('CMS section not found.');
    this.assertRegisteredContent(section.type, section.draftContent);
    if (section.type === PORTFOLIO_PROJECT_TYPE) await this.assertUniquePortfolioSlug(section.pageId, section.draftContent, id);
    const definition = getSectionDefinition(section.type);
    if (!definition || section.page.slug !== definition.page) throw new UnprocessableEntityException('The section is not registered for its page.');
    const version = ((await this.prisma.cmsSectionRevision.aggregate({ where: { sectionId: id }, _max: { version: true } }))._max.version ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const publishedAt = new Date();
      await tx.cmsSectionRevision.create({ data: { sectionId: id, version, status: 'PUBLISHED', content: section.draftContent as Prisma.InputJsonValue, order: section.draftOrder, isVisible: section.draftIsVisible } });
      const updated = await tx.cmsSection.update({ where: { id }, data: { publishedContent: section.draftContent as Prisma.InputJsonValue, publishedOrder: section.draftOrder, publishedIsVisible: section.draftIsVisible, publishedAt } });
      await tx.cmsPage.update({ where: { id: section.pageId }, data: { publishedAt } });
      return updated;
    });
  }

  async deletePortfolioProjectSection(id: string, dto: DeleteSectionDto) {
    if (dto.confirm !== true) throw new UnprocessableEntityException('Explicit confirmation is required to delete a portfolio project.');
    const section = await this.prisma.cmsSection.findUnique({ where: { id }, include: { page: true } });
    if (!section) throw new NotFoundException('CMS section not found.');
    if (section.type !== PORTFOLIO_PROJECT_TYPE || section.page.slug !== 'portfolio') {
      throw new UnprocessableEntityException('Only portfolio project sections can be deleted through this endpoint.');
    }
    return this.prisma.cmsSection.delete({ where: { id } });
  }

  async publishPortfolioOrder(pageId: string, dto: ReorderSectionsDto) {
    const page = await this.prisma.cmsPage.findUnique({ where: { id: pageId }, select: { id: true, slug: true } });
    if (!page || page.slug !== 'portfolio') throw new UnprocessableEntityException('Published portfolio ordering is only supported for the Portfolio page.');
    const sections = await this.prisma.cmsSection.findMany({
      where: { pageId, type: PORTFOLIO_PROJECT_TYPE, publishedContent: { not: Prisma.JsonNull } },
      select: { id: true },
    });
    const knownIds = new Set(sections.map(({ id }) => id));
    if (dto.sectionIds.length !== sections.length || dto.sectionIds.some((id) => !knownIds.has(id)) || new Set(dto.sectionIds).size !== dto.sectionIds.length) {
      throw new UnprocessableEntityException('The published project order must contain every published project exactly once.');
    }
    return this.prisma.$transaction(async (tx) => {
      const updates = await Promise.all(dto.sectionIds.map((id, order) => tx.cmsSection.update({ where: { id }, data: { publishedOrder: order } })));
      await tx.cmsPage.update({ where: { id: pageId }, data: { publishedAt: new Date() } });
      return updates;
    });
  }

  async reorderSections(pageId: string, dto: ReorderSectionsDto) {
    const sections = await this.prisma.cmsSection.findMany({ where: { pageId }, select: { id: true } });
    const knownIds = new Set(sections.map(({ id }) => id));
    if (dto.sectionIds.length !== sections.length || dto.sectionIds.some((id) => !knownIds.has(id))) {
      throw new UnprocessableEntityException('The section order must contain every section exactly once.');
    }
    return this.prisma.$transaction(dto.sectionIds.map((id, order) => this.prisma.cmsSection.update({ where: { id }, data: { draftOrder: order, draftUpdatedAt: new Date() } })));
  }

  private async assertUniquePortfolioSlug(pageId: string, content: unknown, excludeId?: string): Promise<void> {
    if (!content || typeof content !== 'object') return;
    const slug = (content as Record<string, unknown>).slug;
    if (typeof slug !== 'string' || !slug.trim()) return;
    const sections = await this.prisma.cmsSection.findMany({
      where: { pageId, type: PORTFOLIO_PROJECT_TYPE, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { draftContent: true, publishedContent: true },
    });
    const collision = sections.some(({ draftContent, publishedContent }) => {
      const draftSlug = draftContent && typeof draftContent === 'object' ? (draftContent as Record<string, unknown>).slug : undefined;
      const publishedSlug = publishedContent && typeof publishedContent === 'object' ? (publishedContent as Record<string, unknown>).slug : undefined;
      return draftSlug === slug || publishedSlug === slug;
    });
    if (collision) throw new UnprocessableEntityException('A portfolio project already uses this slug in a draft or published snapshot.');
  }

  private assertRegisteredContent(type: string, content: unknown, draft = false): void {
    const definition = getSectionDefinition(type);
    if (!definition) throw new UnprocessableEntityException(`Unsupported CMS section type: ${type}`);
    const validate = draft ? (definition.validateDraft ?? definition.validate) : definition.validate;
    if (!validate(content)) throw new UnprocessableEntityException(`Invalid content for CMS section type: ${type}`);
  }

  private assertGlobalComponentType(type: string): void {
    if (!getGlobalComponentDefinition(type)) throw new UnprocessableEntityException(`Unsupported global component type: ${type}`);
  }

  private assertGlobalComponentContent(type: string, content: unknown, draft = false): void {
    const definition = getGlobalComponentDefinition(type);
    if (!definition) throw new UnprocessableEntityException(`Unsupported global component type: ${type}`);
    const valid = draft ? definition.validateDraft(content) : definition.validate(content);
    if (!valid) {
      const details = type === GLOBAL_FOOTER_TYPE ? getFooterContentIssues(content) : [];
      throw new UnprocessableEntityException(`Invalid content for global component type: ${type}${details.length ? ` (invalid fields: ${details.join(', ')})` : ''}`);
    }
  }
}
