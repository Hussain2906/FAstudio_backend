import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { footerDefaultContent, GLOBAL_FOOTER_TYPE } from '@fs/cms-contracts';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const connectionString = process.env.DIRECT_URL;
if (!connectionString) throw new Error('DIRECT_URL is required for the CMS seed command.');
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
try {
  const existing = await prisma.cmsGlobalComponent.findUnique({ where: { type: GLOBAL_FOOTER_TYPE }, select: { id: true } });
  if (existing) console.log('Footer configuration already exists; no content was changed.');
  else {
    await prisma.cmsGlobalComponent.create({ data: { type: GLOBAL_FOOTER_TYPE, draftContent: footerDefaultContent } });
    console.log('Footer configuration seeded as an unpublished draft.');
  }
} finally { await prisma.$disconnect(); }
