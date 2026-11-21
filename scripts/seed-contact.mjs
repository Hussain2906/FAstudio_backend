import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import {
  CONTACT_PAGE_TYPE,
  sectionRegistry,
} from '@fs/cms-contracts';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const connectionString = process.env.DIRECT_URL;
if (!connectionString)
  throw new Error('DIRECT_URL is required for the Contact page seed command.');
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

try {
  const page = await prisma.cmsPage.upsert({
    where: { slug: 'contact' },
    update: {},
    create: { slug: 'contact', name: 'Contact' },
  });
  const existing = await prisma.cmsSection.findFirst({
    where: { pageId: page.id, type: CONTACT_PAGE_TYPE },
    select: { id: true },
  });

  if (existing) {
    console.log('Contact page and section already exist; no content was changed.');
  } else {
    const definition = sectionRegistry.find((entry) => entry.type === CONTACT_PAGE_TYPE);
    if (!definition) throw new Error(`Contact section is not registered: ${CONTACT_PAGE_TYPE}`);
    await prisma.cmsSection.create({
      data: {
        pageId: page.id,
        type: CONTACT_PAGE_TYPE,
        draftContent: definition.defaultContent,
        draftOrder: 0,
        draftIsVisible: true,
      },
    });
    console.log(
      'Contact page seeded safely with a CMS draft. Existing content was preserved; publish it from Admin when ready.',
    );
  }
} finally {
  await prisma.$disconnect();
}
