import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import {
  PORTFOLIO_CATALOGUE_TYPE,
  PORTFOLIO_HERO_TYPE,
  portfolioCatalogueDefaultContent,
  portfolioHeroDefaultContent,
} from '@fs/cms-contracts';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const connectionString = process.env.DIRECT_URL;
if (!connectionString) throw new Error('DIRECT_URL is required for the Portfolio seed command.');

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

try {
  const page = await prisma.cmsPage.upsert({
    where: { slug: 'portfolio' },
    update: {},
    create: { slug: 'portfolio', name: 'Portfolio' },
  });
  const sections = [
    { type: PORTFOLIO_HERO_TYPE, content: portfolioHeroDefaultContent, order: 0 },
    { type: PORTFOLIO_CATALOGUE_TYPE, content: portfolioCatalogueDefaultContent, order: 1 },
  ];
  for (const section of sections) {
    const existing = await prisma.cmsSection.findFirst({
      where: { pageId: page.id, type: section.type },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.cmsSection.create({
      data: {
        pageId: page.id,
        type: section.type,
        draftContent: section.content,
        draftOrder: section.order,
        draftIsVisible: true,
      },
    });
  }
  console.log('Portfolio page seeded safely: existing content was preserved; only missing Hero and Catalogue sections were added as drafts. No projects were created or published.');
} finally {
  await prisma.$disconnect();
}
