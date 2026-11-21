import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { sectionRegistry, ABOUT_SECTION_TYPES, aboutSectionDefaultVisibility } from '@fs/cms-contracts';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const connectionString = process.env.DIRECT_URL;
if (!connectionString) throw new Error('DIRECT_URL is required for the About page seed command.');
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

try {
  const page = await prisma.cmsPage.upsert({ where: { slug: 'about' }, update: {}, create: { slug: 'about', name: 'About' } });
  const definitions = ABOUT_SECTION_TYPES.map((type) => sectionRegistry.find((entry) => entry.type === type)).filter(Boolean);
  for (const [order, definition] of definitions.entries()) {
    const existing = await prisma.cmsSection.findFirst({ where: { pageId: page.id, type: definition.type }, select: { id: true } });
    if (existing) continue;
    await prisma.cmsSection.create({
      data: {
        pageId: page.id,
        type: definition.type,
        draftContent: definition.defaultContent,
        draftOrder: order,
        draftIsVisible: aboutSectionDefaultVisibility[definition.type],
      },
    });
  }
  console.log('About page seeded safely: existing page and section content were preserved; only missing sections were added as drafts.');
} finally {
  await prisma.$disconnect();
}
