import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { homeHeroDefaultContent, HOME_HERO_TYPE } from '@fs/cms-contracts';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const connectionString = process.env.DIRECT_URL;
if (!connectionString) throw new Error('DIRECT_URL is required for the CMS seed command.');

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

try {
  const page = await prisma.cmsPage.upsert({
    where: { slug: 'home' },
    update: {},
    create: { slug: 'home', name: 'Home' },
  });
  const existing = await prisma.cmsSection.findFirst({ where: { pageId: page.id, type: HOME_HERO_TYPE }, select: { id: true } });
  if (existing) {
    console.log('Home Hero already exists; no content was changed.');
  } else {
    await prisma.cmsSection.create({ data: { pageId: page.id, type: HOME_HERO_TYPE, draftContent: homeHeroDefaultContent, draftOrder: 0, draftIsVisible: true } });
    console.log('Home Hero seeded as an unpublished draft. Upload an image before publishing.');
  }
} finally {
  await prisma.$disconnect();
}
