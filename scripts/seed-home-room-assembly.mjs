import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { HOME_ROOM_ASSEMBLY_TYPE, homeRoomAssemblyDefaultContent } from '@fs/cms-contracts';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const connectionString = process.env.DIRECT_URL;
if (!connectionString) throw new Error('DIRECT_URL is required for the CMS seed command.');

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

try {
  const page = await prisma.cmsPage.upsert({ where: { slug: 'home' }, update: {}, create: { slug: 'home', name: 'Home' } });
  const existing = await prisma.cmsSection.findFirst({ where: { pageId: page.id, type: HOME_ROOM_ASSEMBLY_TYPE }, select: { id: true } });
  if (existing) {
    console.log('Home Room Assembly already exists; no content was changed.');
  } else {
    await prisma.cmsSection.create({ data: { pageId: page.id, type: HOME_ROOM_ASSEMBLY_TYPE, draftContent: homeRoomAssemblyDefaultContent, draftOrder: 3, draftIsVisible: true } });
    console.log('Home Room Assembly seeded as an unpublished draft. Upload the backdrop and transparent room layers before publishing.');
  }
} finally {
  await prisma.$disconnect();
}
