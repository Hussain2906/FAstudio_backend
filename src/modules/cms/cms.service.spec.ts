import { PORTFOLIO_PROJECT_TYPE, SERVICES_CATALOGUE_TYPE, portfolioProjectDefaultContent, servicesCatalogueDefaultContent } from '@fs/cms-contracts';
import type { PrismaService } from '../../database/prisma.service.js';
import { CmsService } from './cms.service.js';

type UpdateCall = { where: { id: string }; data: Record<string, unknown> };
type CreateCall = { data: Record<string, unknown> };
type PageUpdateCall = { where: { id: string }; data: Record<string, unknown> };

describe('Services CMS publishing workflow', () => {
  it('saves catalogue edits to the draft fields without replacing published content', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'services-catalogue' });
    const prisma = {
      cmsSection: {
        findUnique: jest.fn().mockResolvedValue({ type: SERVICES_CATALOGUE_TYPE }),
        update,
      },
    };
    const service = new CmsService(prisma as unknown as PrismaService);

    await service.updateSection('services-catalogue', {
      content: servicesCatalogueDefaultContent,
      isVisible: false,
    });

    expect(update).toHaveBeenCalledTimes(1);
    const updateCalls = update.mock.calls as unknown as Array<[UpdateCall]>;
    const updateData = updateCalls[0]?.[0].data;
    expect(updateData).toMatchObject({
      draftContent: servicesCatalogueDefaultContent,
      draftIsVisible: false,
    });
    expect(updateData?.draftUpdatedAt).toBeInstanceOf(Date);
    expect(updateData).not.toHaveProperty('publishedContent');
    expect(updateData).not.toHaveProperty('publishedIsVisible');
  });

  it('copies the saved catalogue draft to the published snapshot only on publish', async () => {
    const section = {
      id: 'services-catalogue',
      pageId: 'services-page',
      type: SERVICES_CATALOGUE_TYPE,
      draftContent: servicesCatalogueDefaultContent,
      draftOrder: 1,
      draftIsVisible: false,
      page: { slug: 'services' },
    };
    const transaction = {
      cmsSectionRevision: { create: jest.fn().mockResolvedValue({}) },
      cmsSection: { update: jest.fn().mockResolvedValue({ id: section.id }) },
      cmsPage: { update: jest.fn().mockResolvedValue({ id: section.pageId }) },
    };
    const prisma = {
      cmsSection: { findUnique: jest.fn().mockResolvedValue(section) },
      cmsSectionRevision: { aggregate: jest.fn().mockResolvedValue({ _max: { version: null } }) },
      $transaction: jest.fn((callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new CmsService(prisma as unknown as PrismaService);

    await service.publishSection(section.id);

    const revisionCalls = transaction.cmsSectionRevision.create.mock.calls as unknown as Array<
      [CreateCall]
    >;
    const revisionData = revisionCalls[0]?.[0].data;
    expect(revisionData).toMatchObject({
      sectionId: section.id,
      version: 1,
      status: 'PUBLISHED',
      content: servicesCatalogueDefaultContent,
      order: 1,
      isVisible: false,
    });

    const publishedCalls = transaction.cmsSection.update.mock.calls as unknown as Array<
      [UpdateCall]
    >;
    const publishedData = publishedCalls[0]?.[0].data;
    expect(publishedData).toMatchObject({
      publishedContent: servicesCatalogueDefaultContent,
      publishedOrder: 1,
      publishedIsVisible: false,
    });

    const pageCalls = transaction.cmsPage.update.mock.calls as unknown as Array<[PageUpdateCall]>;
    expect(pageCalls[0]?.[0].where).toEqual({ id: section.pageId });
    expect(pageCalls[0]?.[0].data.publishedAt).toBeInstanceOf(Date);
  });

  it('serves only published, visible section snapshots on the public page', async () => {
    const publishedContent = { ...servicesCatalogueDefaultContent, heading: 'Published heading' };
    const findUnique = jest.fn().mockResolvedValue({
      id: 'services-page',
      slug: 'services',
      name: 'Services',
      publishedAt: new Date(),
      sections: [
        {
          id: 'services-catalogue',
          type: SERVICES_CATALOGUE_TYPE,
          publishedContent,
          publishedOrder: 1,
          publishedIsVisible: true,
        },
        {
          id: 'hidden-services-catalogue',
          type: SERVICES_CATALOGUE_TYPE,
          publishedContent: { ...servicesCatalogueDefaultContent, heading: 'Hidden content' },
          publishedOrder: 2,
          publishedIsVisible: false,
        },
      ],
    });
    const prisma = { cmsPage: { findUnique } };
    const service = new CmsService(prisma as unknown as PrismaService);

    const result = await service.getPublishedPage('services');

    const queryCalls = findUnique.mock.calls as unknown as Array<
      [
        {
          where: { slug: string };
          include: {
            sections: {
              where: Record<string, unknown>;
              orderBy: { publishedOrder: 'asc' };
              select: Record<string, boolean>;
            };
          };
        },
      ]
    >;
    const query = queryCalls[0]?.[0];
    expect(query?.where).toEqual({ slug: 'services' });
    expect(query?.include.sections.where).not.toHaveProperty('publishedIsVisible');
    expect(query?.include.sections.where).toHaveProperty('publishedContent.not');
    expect(query?.include.sections.select).toEqual({
      id: true,
      type: true,
      publishedContent: true,
      publishedOrder: true,
      publishedIsVisible: true,
    });
    expect(result.sectionStates).toEqual([
      { id: 'services-catalogue', type: SERVICES_CATALOGUE_TYPE, isVisible: true },
      { id: 'hidden-services-catalogue', type: SERVICES_CATALOGUE_TYPE, isVisible: false },
    ]);
    expect(result.sections).toEqual([
      {
        id: 'services-catalogue',
        type: SERVICES_CATALOGUE_TYPE,
        content: publishedContent,
        order: 1,
        renderer: SERVICES_CATALOGUE_TYPE,
      },
    ]);
  });
});

describe('Portfolio project CMS operations', () => {
  const image = {
    publicId: 'portfolio/project',
    url: 'https://res.cloudinary.com/example/image/upload/portfolio/project',
    width: 1200,
    height: 900,
    alt: 'A finished residential interior.',
  };
  const galleryImage = {
    ...image,
    publicId: 'portfolio/project-gallery',
    url: 'https://res.cloudinary.com/example/image/upload/portfolio/project-gallery',
    alt: 'A complementary residential detail.',
  };
  const project = {
    ...portfolioProjectDefaultContent,
    slug: 'oak-residence',
    title: 'Oak Residence',
    category: 'Residential',
    shortDescription: 'A calm home shaped around natural materials.',
    coverImage: image,
    gallery: [galleryImage],
  };

  it('serves only the Portfolio published snapshot and omits draft-only projects', async () => {
    const publishedContent = { ...project, title: 'Published Oak Residence' };
    const findUnique = jest.fn().mockResolvedValue({
      id: 'portfolio-page',
      slug: 'portfolio',
      name: 'Portfolio',
      publishedAt: new Date(),
      sections: [
        {
          id: 'visible-project',
          type: PORTFOLIO_PROJECT_TYPE,
          publishedContent,
          publishedOrder: 1,
          publishedIsVisible: true,
        },
        {
          id: 'hidden-project',
          type: PORTFOLIO_PROJECT_TYPE,
          publishedContent: { ...project, title: 'Hidden Published Project' },
          publishedOrder: 2,
          publishedIsVisible: false,
        },
        {
          id: 'draft-only-project',
          type: PORTFOLIO_PROJECT_TYPE,
          publishedContent: null,
          publishedOrder: null,
          publishedIsVisible: true,
        },
      ],
    });
    const service = new CmsService({ cmsPage: { findUnique } } as unknown as PrismaService);

    const result = await service.getPublishedPage('portfolio');

    const queryCalls = findUnique.mock.calls as unknown as Array<[
      {
        include: {
          sections: {
            where: Record<string, unknown>;
            orderBy: { publishedOrder: 'asc' };
            select: Record<string, boolean>;
          };
        };
      },
    ]>;
    const query = queryCalls[0]?.[0];
    expect(query?.include.sections.where).toHaveProperty('publishedContent.not');
    expect(query?.include.sections.orderBy).toEqual({ publishedOrder: 'asc' });
    expect(query?.include.sections.select).toEqual({
      id: true,
      type: true,
      publishedContent: true,
      publishedOrder: true,
      publishedIsVisible: true,
    });
    expect(result.sectionStates).toEqual([
      { id: 'visible-project', type: PORTFOLIO_PROJECT_TYPE, isVisible: true },
      { id: 'hidden-project', type: PORTFOLIO_PROJECT_TYPE, isVisible: false },
    ]);
    expect(result.sections).toEqual([
      {
        id: 'visible-project',
        type: PORTFOLIO_PROJECT_TYPE,
        content: publishedContent,
        order: 1,
        renderer: PORTFOLIO_PROJECT_TYPE,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('draftContent');
    expect(JSON.stringify(result)).not.toContain('draft-only-project');
  });

  it('allows multiple Portfolio Project sections while enforcing cross-snapshot slug uniqueness', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'project-2' });
    const prisma = {
      cmsPage: { findUnique: jest.fn().mockResolvedValue({ slug: 'portfolio' }) },
      cmsSection: {
        findMany: jest.fn()
          .mockResolvedValueOnce([{ draftContent: { slug: 'existing-project' }, publishedContent: null }])
          .mockResolvedValueOnce([{ draftContent: { slug: 'existing-project' }, publishedContent: null }])
          .mockResolvedValueOnce([{ draftContent: { slug: '' }, publishedContent: { slug: 'published-project' } }]),
        create,
      },
    };
    const service = new CmsService(prisma as unknown as PrismaService);
    await service.createSection('portfolio-page', { type: PORTFOLIO_PROJECT_TYPE, content: project, order: 1 });
    const createCalls = create.mock.calls as unknown as Array<[CreateCall]>;
    expect(createCalls[0]?.[0].data).toMatchObject({
      type: PORTFOLIO_PROJECT_TYPE,
      draftContent: project,
    });
    await expect(service.createSection('portfolio-page', { type: PORTFOLIO_PROJECT_TYPE, content: { ...project, slug: 'existing-project' } })).rejects.toThrow('already uses this slug');
    await expect(service.createSection('portfolio-page', { type: PORTFOLIO_PROJECT_TYPE, content: { ...project, slug: 'published-project' } })).rejects.toThrow('already uses this slug');
  });

  it('saves Portfolio Project edits to the draft snapshot only', async () => {
    const updatedProject = { ...project, title: 'Updated Oak Residence' };
    const update = jest.fn().mockResolvedValue({ id: 'project-1' });
    const prisma = {
      cmsSection: {
        findUnique: jest.fn().mockResolvedValue({ type: PORTFOLIO_PROJECT_TYPE, pageId: 'portfolio-page' }),
        findMany: jest.fn().mockResolvedValue([]),
        update,
      },
    };
    const service = new CmsService(prisma as unknown as PrismaService);

    await service.updateSection('project-1', { content: updatedProject, order: 3, isVisible: false });

    const updateCalls = update.mock.calls as unknown as Array<[UpdateCall]>;
    const updateData = updateCalls[0]?.[0].data;
    expect(updateData).toMatchObject({
      draftContent: updatedProject,
      draftOrder: 3,
      draftIsVisible: false,
    });
    expect(updateData?.draftUpdatedAt).toBeInstanceOf(Date);
    expect(updateData).not.toHaveProperty('publishedContent');
    expect(updateData).not.toHaveProperty('publishedOrder');
    expect(updateData).not.toHaveProperty('publishedIsVisible');
  });

  it('publishes a validated Portfolio Project draft as an immutable published snapshot', async () => {
    const section = {
      id: 'project-1',
      pageId: 'portfolio-page',
      type: PORTFOLIO_PROJECT_TYPE,
      draftContent: project,
      draftOrder: 3,
      draftIsVisible: true,
      publishedContent: { ...project, title: 'Earlier published title' },
      publishedOrder: 1,
      publishedIsVisible: false,
      page: { id: 'portfolio-page', slug: 'portfolio' },
    };
    const transaction = {
      cmsSectionRevision: { create: jest.fn().mockResolvedValue({}) },
      cmsSection: { update: jest.fn().mockResolvedValue({ id: section.id }) },
      cmsPage: { update: jest.fn().mockResolvedValue({ id: section.pageId }) },
    };
    const prisma = {
      cmsSection: {
        findUnique: jest.fn().mockResolvedValue(section),
        findMany: jest.fn().mockResolvedValue([]),
      },
      cmsSectionRevision: { aggregate: jest.fn().mockResolvedValue({ _max: { version: 2 } }) },
      $transaction: jest.fn((callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new CmsService(prisma as unknown as PrismaService);

    await service.publishSection(section.id);

    const revisionCalls = transaction.cmsSectionRevision.create.mock.calls as unknown as Array<
      [CreateCall]
    >;
    expect(revisionCalls[0]?.[0].data).toMatchObject({
      sectionId: section.id,
      version: 3,
      status: 'PUBLISHED',
      content: project,
      order: 3,
      isVisible: true,
    });
    const publishCalls = transaction.cmsSection.update.mock.calls as unknown as Array<[UpdateCall]>;
    expect(publishCalls[0]?.[0].data).toMatchObject({
      publishedContent: project,
      publishedOrder: 3,
      publishedIsVisible: true,
    });
    expect(publishCalls[0]?.[0].data).not.toHaveProperty('draftContent');
    const pageCalls = transaction.cmsPage.update.mock.calls as unknown as Array<[PageUpdateCall]>;
    expect(pageCalls[0]?.[0].data.publishedAt).toBeInstanceOf(Date);
  });

  it('publishes order without replacing published content or visibility', async () => {
    const sectionUpdate = jest.fn().mockResolvedValue({ id: 'project-1' });
    const transaction = {
      cmsSection: { update: sectionUpdate },
      cmsPage: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      cmsPage: { findUnique: jest.fn().mockResolvedValue({ id: 'portfolio-page', slug: 'portfolio' }) },
      cmsSection: { findMany: jest.fn().mockResolvedValue([{ id: 'project-1' }, { id: 'project-2' }]) },
      $transaction: jest.fn((callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction)),
    };
    const service = new CmsService(prisma as unknown as PrismaService);
    await service.publishPortfolioOrder('portfolio-page', { sectionIds: ['project-2', 'project-1'] });
    const calls = sectionUpdate.mock.calls as unknown as Array<[UpdateCall]>;
    expect(calls.map(([call]) => call)).toEqual([
      { where: { id: 'project-2' }, data: { publishedOrder: 0 } },
      { where: { id: 'project-1' }, data: { publishedOrder: 1 } },
    ]);
    expect(calls[0]?.[0].data).not.toHaveProperty('publishedContent');
    expect(calls[0]?.[0].data).not.toHaveProperty('publishedIsVisible');
  });

  it('requires explicit confirmation and restricts deletion to Portfolio Project sections', async () => {
    const remove = jest.fn().mockResolvedValue({ id: 'project-1' });
    const section = { id: 'project-1', type: PORTFOLIO_PROJECT_TYPE, page: { slug: 'portfolio' } };
    const prisma = { cmsSection: { findUnique: jest.fn().mockResolvedValue(section), delete: remove } };
    const service = new CmsService(prisma as unknown as PrismaService);
    await expect(service.deletePortfolioProjectSection('project-1', { confirm: false })).rejects.toThrow('Explicit confirmation');
    await service.deletePortfolioProjectSection('project-1', { confirm: true });
    expect(remove).toHaveBeenCalledWith({ where: { id: 'project-1' } });
  });
});
