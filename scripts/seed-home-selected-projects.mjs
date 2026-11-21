import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { HOME_SELECTED_PROJECTS_TYPE, homeSelectedProjectsDefaultContent } from '@fs/cms-contracts';
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
  const existing = await prisma.cmsSection.findFirst({ where: { pageId: page.id, type: HOME_SELECTED_PROJECTS_TYPE }, select: { id: true } });
  if (existing) {
    console.log('Home Selected Projects already exists; no content was changed.');
  } else {
    await prisma.cmsSection.create({ data: { pageId: page.id, type: HOME_SELECTED_PROJECTS_TYPE, draftContent: homeSelectedProjectsDefaultContent, draftOrder: 2, draftIsVisible: true } });
    console.log('Home Selected Projects seeded as an unpublished draft. Add and verify projects before publishing.');
  }
} finally {
  await prisma.$disconnect();
}
