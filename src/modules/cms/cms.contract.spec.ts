import {
  ABOUT_SECTION_TYPES,
  CONTACT_PAGE_TYPE,
  contactPageDefaultContent,
  isContactPageContent,
  isContactPageDraftContent,
  PORTFOLIO_CATALOGUE_TYPE,
  PORTFOLIO_HERO_TYPE,
  PORTFOLIO_PROJECT_TYPE,
  PROCESS_STEPS_TYPE,
  SERVICES_CATALOGUE_TYPE,
  SERVICES_HERO_TYPE,
  aboutSectionDefaultVisibility,
  aboutSectionDefaults,
  homeDesignConsultationDefaultContent,
  homeExperienceDefaultContent,
  homeSelectedProjectsDefaultContent,
  isAboutSectionContent,
  isHomeDesignConsultationContent,
  isHomeExperienceContent,
  isHomeExperienceDraftContent,
  isHomeSelectedProjectsContent,
  isHomeSelectedProjectsDraftContent,
  isPortfolioCatalogueContent,
  isPortfolioHeroContent,
  isPortfolioHeroDraftContent,
  isPortfolioVideo,
  isPortfolioProjectContent,
  isPortfolioProjectDraftContent,
  isProcessStepsContent,
  isProcessStepsDraftContent,
  processStepsDefaultContent,
  portfolioCatalogueDefaultContent,
  portfolioHeroDefaultContent,
  portfolioProjectDefaultContent,
  isServicesCatalogueContent,
  isServicesCatalogueDraftContent,
  isServicesHeroContent,
  isServicesHeroDraftContent,
  normalizeHomeDesignConsultationContent,
  sectionRegistry,
  servicesCatalogueDefaultContent,
  servicesHeroDefaultContent,
  servicesSectionDefaultVisibility,
} from '@fs/cms-contracts';

describe('About page CMS contracts', () => {
  it('registers ten About sections with valid defaults and independent ordering/visibility', () => {
    expect(ABOUT_SECTION_TYPES).toHaveLength(10);
    for (const type of ABOUT_SECTION_TYPES) {
      const definition = sectionRegistry.find((section) => section.type === type);
      expect(definition?.page).toBe('about');
      expect(definition?.supportsVisibility).toBe(true);
      expect(definition?.supportsOrdering).toBe(true);
      expect(isAboutSectionContent(aboutSectionDefaults[type])).toBe(true);
    }
  });

  it('keeps unverified or optional material hidden by default', () => {
    expect(aboutSectionDefaultVisibility['about.designer']).toBe(true);
    expect(aboutSectionDefaultVisibility['about.metrics']).toBe(false);
    expect(aboutSectionDefaultVisibility['about.press']).toBe(false);
    expect(aboutSectionDefaultVisibility['about.projects']).toBe(false);
    expect(aboutSectionDefaultVisibility['about.testimonials']).toBe(false);
    expect(aboutSectionDefaults['about.designer'].designerName).not.toBe('Fatima Alvi');
    expect(aboutSectionDefaults['about.designer'].image).toBeNull();
  });
});

describe('Home Design Consultation CMS contract', () => {
  it('accepts the configured Cal.com event URL as the initial CMS value', () => {
    expect(isHomeDesignConsultationContent(homeDesignConsultationDefaultContent)).toBe(true);
    expect(homeDesignConsultationDefaultContent.calcomUrl).toBe(
      'https://cal.com/hussain-r8h2rf/fs-studio-design-consultation',
    );
  });

  it('accepts Cal.com event links and rejects unsafe or unrelated destinations', () => {
    const configured = {
      ...homeDesignConsultationDefaultContent,
      calcomUrl: 'https://cal.com/fs-studio/consultation',
    };
    expect(isHomeDesignConsultationContent(configured)).toBe(true);
    expect(
      isHomeDesignConsultationContent({ ...configured, calcomUrl: 'javascript:alert(1)' }),
    ).toBe(false);
    expect(
      isHomeDesignConsultationContent({ ...configured, calcomUrl: 'https://example.com/booking' }),
    ).toBe(false);
    expect(
      isHomeDesignConsultationContent({
        ...configured,
        calcomUrl: 'https://cal.com/only-one-segment',
      }),
    ).toBe(false);
  });

  it('accepts a CMS consultation image with alt text and rejects missing image alt text', () => {
    const image = {
      publicId: 'consultation/workspace',
      url: 'https://res.cloudinary.com/example/image/upload/consultation/workspace',
      width: 1800,
      height: 1200,
    };
    const withImage = {
      ...homeDesignConsultationDefaultContent,
      consultationImage: image,
      consultationImageAlt: 'Material samples on a marble design studio desk.',
    };
    expect(isHomeDesignConsultationContent(withImage)).toBe(true);
    expect(isHomeDesignConsultationContent({ ...withImage, consultationImageAlt: '' })).toBe(false);
  });

  it('keeps existing Calendly-shaped section copy live on the configured Cal.com event during migration', () => {
    const legacy = normalizeHomeDesignConsultationContent({
      eyebrow: 'RESERVE A SPACE',
      heading: 'Schedule a Design Consultation',
      description: 'A personalized session to discuss your space, style, and vision.',
      calendlyUrl: '',
    });
    expect(legacy?.calcomUrl).toBe(homeDesignConsultationDefaultContent.calcomUrl);
  });
});

describe('Home Experience CMS contract', () => {
  it('allows the seeded incomplete content as a draft', () => {
    expect(isHomeExperienceDraftContent(homeExperienceDefaultContent)).toBe(true);
    expect(isHomeExperienceContent(homeExperienceDefaultContent)).toBe(false);
  });

  it('requires four statistics and three complete service cards for publishing', () => {
    const published = {
      ...homeExperienceDefaultContent,
      mainImage: {
        publicId: 'experience/main',
        url: 'https://res.cloudinary.com/example/image/upload/experience/main',
        width: 1600,
        height: 1100,
      },
      mainImageAlt: 'Sunlit interior with sculptural furniture and a tree in a ceramic vessel.',
      statistics: homeExperienceDefaultContent.statistics.map((statistic) => ({
        ...statistic,
        accessibleDescription: `${statistic.value}${statistic.suffix} ${statistic.label}`,
      })),
      services: homeExperienceDefaultContent.services.map((service, index) => ({
        ...service,
        image: {
          publicId: `experience/service-${index}`,
          url: `https://res.cloudinary.com/example/image/upload/experience/service-${index}`,
          width: 1000,
          height: 1200,
        },
        imageAlt: `${service.title} interior design service.`,
      })),
    };

    expect(isHomeExperienceContent(published)).toBe(true);
    expect(
      isHomeExperienceContent({ ...published, statistics: published.statistics.slice(0, 3) }),
    ).toBe(false);
    expect(
      isHomeExperienceContent({
        ...published,
        services: published.services.map((service) => ({
          ...service,
          destination: 'https://example.com',
        })),
      }),
    ).toBe(false);
  });
});

describe('Services CMS contracts', () => {
  it('registers independent Hero and Catalogue visibility with draft-safe defaults', () => {
    for (const type of [SERVICES_HERO_TYPE, SERVICES_CATALOGUE_TYPE]) {
      const definition = sectionRegistry.find((section) => section.type === type);
      expect(definition?.page).toBe('services');
      expect(definition?.supportsVisibility).toBe(true);
      expect(definition?.supportsOrdering).toBe(false);
    }
    expect(servicesSectionDefaultVisibility[SERVICES_HERO_TYPE]).toBe(true);
    expect(servicesSectionDefaultVisibility[SERVICES_CATALOGUE_TYPE]).toBe(true);
    expect(isServicesHeroDraftContent(servicesHeroDefaultContent)).toBe(true);
    expect(isServicesHeroContent(servicesHeroDefaultContent)).toBe(false);
    expect(isServicesCatalogueDraftContent(servicesCatalogueDefaultContent)).toBe(true);
    expect(isServicesCatalogueContent(servicesCatalogueDefaultContent)).toBe(true);
  });

  it('requires a real hero image and descriptive alt text for publication', () => {
    const image = {
      publicId: 'services/hero',
      url: 'https://res.cloudinary.com/studio/image/upload/services/hero',
      width: 1800,
      height: 1200,
    };
    const publishable = {
      ...servicesHeroDefaultContent,
      image,
      imageAlt: 'A finished interior with natural materials and warm light.',
    };
    expect(isServicesHeroContent(publishable)).toBe(true);
    expect(isServicesHeroContent({ ...publishable, imageAlt: '' })).toBe(false);
    expect(
      isServicesHeroContent({
        ...publishable,
        image: { ...image, url: 'http://res.cloudinary.com/studio/hero' },
      }),
    ).toBe(false);
    expect(isServicesHeroDraftContent({ ...publishable, image: null, imageAlt: '' })).toBe(true);
  });

  it('supports an uncapped catalogue and preserves individually disabled items', () => {
    const items = Array.from({ length: 250 }, (_, order) => ({
      id: `service-${order}`,
      title: `Service ${order}`,
      shortDescription: `Description ${order}`,
      detailedDescription: '',
      image: null,
      imageAlt: '',
      destinationUrl: '',
      enabled: true,
      order,
    }));
    items.push({
      id: 'hidden-draft',
      title: '',
      shortDescription: '',
      detailedDescription: '',
      image: null,
      imageAlt: '',
      destinationUrl: '',
      enabled: false,
      order: 250,
    });
    const catalogue = { ...servicesCatalogueDefaultContent, items };
    expect(isServicesCatalogueDraftContent(catalogue)).toBe(true);
    expect(isServicesCatalogueContent(catalogue)).toBe(true);
  });

  it('rejects duplicate IDs, duplicate display orders, and unsafe card destinations', () => {
    const item = {
      id: 'service-1',
      title: 'Residential Design',
      shortDescription: 'An interior design service.',
      detailedDescription: '',
      image: null,
      imageAlt: '',
      destinationUrl: '/contact',
      enabled: true,
      order: 0,
    };
    expect(isServicesCatalogueContent({ ...servicesCatalogueDefaultContent, items: [item] })).toBe(
      true,
    );
    expect(
      isServicesCatalogueDraftContent({
        ...servicesCatalogueDefaultContent,
        items: [item, { ...item, order: 1 }],
      }),
    ).toBe(false);
    expect(
      isServicesCatalogueDraftContent({
        ...servicesCatalogueDefaultContent,
        items: [item, { ...item, id: 'service-2' }],
      }),
    ).toBe(false);
    expect(
      isServicesCatalogueContent({
        ...servicesCatalogueDefaultContent,
        items: [{ ...item, destinationUrl: 'javascript:alert(1)' }],
      }),
    ).toBe(false);
    expect(
      isServicesCatalogueContent({
        ...servicesCatalogueDefaultContent,
        items: [{ ...item, destinationUrl: '//example.com' }],
      }),
    ).toBe(false);
    expect(
      isServicesCatalogueContent({
        ...servicesCatalogueDefaultContent,
        items: [{ ...item, destinationUrl: 'https:example.com' }],
      }),
    ).toBe(false);
    expect(
      isServicesCatalogueContent({
        ...servicesCatalogueDefaultContent,
        items: [{ ...item, title: '' }],
      }),
    ).toBe(false);
  });
});

describe('Portfolio CMS contracts', () => {
  it('registers Hero, Catalogue, and repeatable Project definitions on Portfolio', () => {
    for (const type of [PORTFOLIO_HERO_TYPE, PORTFOLIO_CATALOGUE_TYPE, PORTFOLIO_PROJECT_TYPE]) {
      const definition = sectionRegistry.find((section) => section.type === type);
      expect(definition?.page).toBe('portfolio');
      expect(definition?.validateDraft?.(definition.defaultContent)).toBe(true);
    }
    expect(isPortfolioHeroContent(portfolioHeroDefaultContent)).toBe(true);
    expect(isPortfolioCatalogueContent(portfolioCatalogueDefaultContent)).toBe(true);
    expect(isPortfolioProjectDraftContent(portfolioProjectDefaultContent)).toBe(true);
    expect(isPortfolioProjectContent(portfolioProjectDefaultContent)).toBe(false);
  });

  it('accepts validated MP4 hero media and remains compatible with older hero content', () => {
    const video = {
      publicId: 'portfolio/hero-background',
      url: 'https://res.cloudinary.com/example/video/upload/v1/portfolio/hero-background.mp4',
      width: 1920,
      height: 1080,
      resourceType: 'video',
      format: 'mp4',
      bytes: 4_000_000,
      posterUrl:
        'https://res.cloudinary.com/example/video/upload/so_0/v1/portfolio/hero-background.jpg',
    } as const;
    expect(isPortfolioVideo(video)).toBe(true);
    expect(isPortfolioHeroDraftContent({ ...portfolioHeroDefaultContent, video })).toBe(true);
    expect(isPortfolioHeroDraftContent({ ...portfolioHeroDefaultContent, video: undefined })).toBe(
      true,
    );
    const legacyHeroContent = {
      eyebrow: portfolioHeroDefaultContent.eyebrow,
      heading: portfolioHeroDefaultContent.heading,
      description: portfolioHeroDefaultContent.description,
      image: portfolioHeroDefaultContent.image,
    };
    expect(isPortfolioHeroContent(legacyHeroContent)).toBe(true);
    expect(isPortfolioVideo({ ...video, url: 'https://example.com/fake.mp4' })).toBe(false);
    expect(isPortfolioVideo({ ...video, format: 'mov' })).toBe(false);
    expect(isPortfolioVideo({ ...video, bytes: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isPortfolioVideo({ ...video, width: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it('requires safe slugs and complete Cloudinary images for project publication', () => {
    const image = {
      publicId: 'portfolio/project-1',
      url: 'https://res.cloudinary.com/example/image/upload/portfolio/project-1',
      width: 1600,
      height: 1200,
      alt: 'A calm living room with natural stone and oak.',
    };
    const galleryImage = {
      ...image,
      publicId: 'portfolio/project-1/gallery-1',
      url: 'https://res.cloudinary.com/example/image/upload/portfolio/project-1/gallery-1',
      alt: 'A dining space with a sculptural pendant light.',
    };
    const project = {
      ...portfolioProjectDefaultContent,
      slug: 'calm-oak-residence',
      title: 'Calm Oak Residence',
      category: 'Residential',
      shortDescription: 'A warm, light-filled family home.',
      coverImage: image,
      gallery: [galleryImage],
    };
    expect(isPortfolioProjectContent(project)).toBe(true);
    expect(isPortfolioProjectContent({ ...project, gallery: [image] })).toBe(false);
    expect(isPortfolioProjectContent({ ...project, gallery: [galleryImage, galleryImage] })).toBe(
      false,
    );
    expect(isPortfolioProjectContent({ ...project, slug: '../unsafe' })).toBe(false);
    expect(isPortfolioProjectContent({ ...project, slug: 'home-existing-project' })).toBe(false);
    expect(isPortfolioProjectContent({ ...project, gallery: [] })).toBe(false);
    expect(isPortfolioProjectContent({ ...project, coverImage: { ...image, alt: '' } })).toBe(
      false,
    );
    expect(
      isPortfolioProjectContent({
        ...project,
        gallery: [{ ...image, url: 'https://example.com/image.jpg' }],
      }),
    ).toBe(false);
    expect(
      isPortfolioProjectDraftContent({ ...portfolioProjectDefaultContent, slug: 'draft-project' }),
    ).toBe(true);
  });
});

describe('Home Selected Projects CMS contract', () => {
  it('allows an empty project collection as a draft', () => {
    expect(isHomeSelectedProjectsDraftContent(homeSelectedProjectsDefaultContent)).toBe(true);
    expect(isHomeSelectedProjectsContent(homeSelectedProjectsDefaultContent)).toBe(false);
  });

  it('requires complete unique projects for publication', () => {
    const projects = [0, 1, 2].map((index) => ({
      id: `project-${index}`,
      title: `Project ${index + 1}`,
      category: 'Residential',
      image: {
        publicId: `projects/${index}`,
        url: `https://res.cloudinary.com/example/projects/${index}`,
        width: 900,
        height: 1200,
      },
      imageAlt: `Architectural interior project ${index + 1}.`,
      destination: 'portfolio' as const,
    }));
    const published = { ...homeSelectedProjectsDefaultContent, projects };
    expect(isHomeSelectedProjectsContent(published)).toBe(true);
    expect(
      isHomeSelectedProjectsContent({
        ...published,
        projects: [{ ...projects[0], id: projects[1].id }, projects[1], projects[2]],
      }),
    ).toBe(false);
    expect(isHomeSelectedProjectsContent({ ...published, projects: projects.slice(0, 2) })).toBe(
      false,
    );
  });
});

describe('Contact page CMS contract', () => {
  it('registers a validated Contact page section with service choices and optional photography', () => {
    const definition = sectionRegistry.find((entry) => entry.type === CONTACT_PAGE_TYPE);
    expect(definition?.page).toBe('contact');
    expect(definition?.supportsVisibility).toBe(true);
    expect(definition?.supportsOrdering).toBe(false);
    expect(isContactPageDraftContent(contactPageDefaultContent)).toBe(true);
    expect(isContactPageContent(contactPageDefaultContent)).toBe(true);
  });

  it('allows incomplete drafts but rejects invalid published copy and media', () => {
    const draft = { ...contactPageDefaultContent, heading: '' };
    expect(isContactPageDraftContent(draft)).toBe(true);
    expect(isContactPageContent(draft)).toBe(false);
    expect(
      isContactPageContent({
        ...contactPageDefaultContent,
        image: {
          publicId: 'interior-portfolio/example',
          url: 'https://example.com/image.jpg',
          width: 1200,
          height: 800,
        },
        imageAlt: 'Interior photograph',
      }),
    ).toBe(false);
  });

  it('rejects duplicate or oversized service choices', () => {
    expect(
      isContactPageDraftContent({
        ...contactPageDefaultContent,
        projectTypes: ['Residential Design', ' residential design '],
      }),
    ).toBe(false);
    expect(
      isContactPageDraftContent({
        ...contactPageDefaultContent,
        projectTypes: ['A'.repeat(81)],
      }),
    ).toBe(false);
  });
});

describe('Process Steps CMS contract', () => {
  const image = {
    publicId: 'process/interior-01',
    url: 'https://res.cloudinary.com/example/process/interior-01',
    width: 1600,
    height: 1000,
  };

  function step(index: number) {
    return {
      id: `step-${index}`,
      order: index,
      enabled: true,
      eyebrow: `Step ${index + 1}`,
      title: `Process step ${index + 1}`,
      summary: `A concise summary for step ${index + 1}.`,
      description: `A verified description for process step ${index + 1}.`,
      image,
      imageAlt: `A completed interior for step ${index + 1}.`,
      imageDecorative: false,
      secondaryCaption: '',
      imagePosition: 'center' as const,
    };
  }

  it('registers a process-specific, empty draft without invented published steps', () => {
    const definition = sectionRegistry.find((entry) => entry.type === PROCESS_STEPS_TYPE);
    expect(definition?.page).toBe('process');
    expect(definition?.supportsVisibility).toBe(true);
    expect(definition?.supportsOrdering).toBe(false);
    expect(isProcessStepsDraftContent(processStepsDefaultContent)).toBe(true);
    expect(processStepsDefaultContent.steps).toEqual([]);
    expect(isProcessStepsContent(processStepsDefaultContent)).toBe(true);
  });

  it('supports arbitrary ordered step counts and published zero-step fallback', () => {
    const steps = Array.from({ length: 14 }, (_, index) => step(index));
    const content = { ...processStepsDefaultContent, enabled: true, steps };
    expect(isProcessStepsDraftContent(content)).toBe(true);
    expect(isProcessStepsContent(content)).toBe(true);
    expect(isProcessStepsContent({ ...content, steps: [] })).toBe(true);
  });

  it('keeps incomplete disabled steps as drafts and blocks incomplete enabled steps', () => {
    const incomplete = {
      ...step(0),
      enabled: false,
      title: '',
      summary: '',
      description: '',
      image: null,
      imageAlt: '',
    };
    expect(isProcessStepsDraftContent({ ...processStepsDefaultContent, steps: [incomplete] })).toBe(
      true,
    );
    expect(isProcessStepsContent({ ...processStepsDefaultContent, steps: [incomplete] })).toBe(
      true,
    );
    expect(
      isProcessStepsContent({
        ...processStepsDefaultContent,
        steps: [{ ...incomplete, enabled: true }],
      }),
    ).toBe(false);
  });

  it('requires decorative classification or descriptive alt text and unique stable ordering', () => {
    const published = { ...processStepsDefaultContent, steps: [step(0), step(1)] };
    expect(isProcessStepsContent(published)).toBe(true);
    expect(
      isProcessStepsContent({
        ...processStepsDefaultContent,
        steps: [{ ...step(0), imageAlt: '', imageDecorative: true }],
      }),
    ).toBe(true);
    expect(
      isProcessStepsContent({
        ...published,
        steps: [published.steps[0], { ...published.steps[1], imageAlt: '' }],
      }),
    ).toBe(false);
    expect(
      isProcessStepsDraftContent({
        ...published,
        steps: [published.steps[0], { ...published.steps[1], id: published.steps[0].id }],
      }),
    ).toBe(false);
    expect(
      isProcessStepsDraftContent({
        ...published,
        steps: [published.steps[0], { ...published.steps[1], order: published.steps[0].order }],
      }),
    ).toBe(false);
  });
});
