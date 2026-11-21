import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import {
  SERVICES_CATALOGUE_TYPE,
  SERVICES_HERO_TYPE,
  sectionRegistry,
  servicesSectionDefaultVisibility,
} from '@fs/cms-contracts';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const connectionString = process.env.DIRECT_URL;
if (!connectionString)
  throw new Error('DIRECT_URL is required for the Services page seed command.');
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

try {
  const page = await prisma.cmsPage.upsert({
    where: { slug: 'services' },
    update: {},
    create: { slug: 'services', name: 'Services' },
  });
  const types = [SERVICES_HERO_TYPE, SERVICES_CATALOGUE_TYPE];
  let created = 0;

  for (const [order, type] of types.entries()) {
    const existing = await prisma.cmsSection.findFirst({
      where: { pageId: page.id, type },
      select: { id: true },
    });
    if (existing) continue;
    const definition = sectionRegistry.find((entry) => entry.type === type);
    if (!definition) throw new Error(`Services section is not registered: ${type}`);
    await prisma.cmsSection.create({
      data: {
        pageId: page.id,
        type,
        draftContent: definition.defaultContent,
        draftOrder: order,
        draftIsVisible: servicesSectionDefaultVisibility[type],
      },
    });
    created += 1;
  }

  console.log(
    created
      ? `Services page seeded safely: ${created} missing section(s) were added as unpublished drafts; existing page, section, media, and published content were preserved.`
      : 'Services page and sections already exist; no content was changed.',
  );
} finally {
  await prisma.$disconnect();
}
