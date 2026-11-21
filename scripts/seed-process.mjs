import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PROCESS_STEPS_TYPE, processStepsDefaultContent, sectionRegistry } from '@fs/cms-contracts';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const connectionString = process.env.DIRECT_URL;
if (!connectionString) throw new Error('DIRECT_URL is required for the Process page seed command.');
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

try {
  const page = await prisma.cmsPage.upsert({
    where: { slug: 'process' },
    update: {},
    create: { slug: 'process', name: 'Our Process' },
  });
  const existing = await prisma.cmsSection.findFirst({
    where: { pageId: page.id, type: PROCESS_STEPS_TYPE },
    select: { id: true },
  });

  if (existing) {
    console.log('Process page and section already exist; no content was changed.');
  } else {
    const definition = sectionRegistry.find((entry) => entry.type === PROCESS_STEPS_TYPE);
    if (!definition) throw new Error(`Process section is not registered: ${PROCESS_STEPS_TYPE}`);
    await prisma.cmsSection.create({
      data: {
        pageId: page.id,
        type: PROCESS_STEPS_TYPE,
        draftContent: processStepsDefaultContent,
        draftOrder: 0,
        draftIsVisible: true,
      },
    });
    console.log(
      'Process page seeded safely with an unpublished, empty draft. Existing content was preserved; no process steps were invented or published.',
    );
  }
} finally {
  await prisma.$disconnect();
}
