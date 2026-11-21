import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

if (!email || !password) throw new Error('Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD locally before running this command.');
if (password.length < 12) throw new Error('ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters.');

const connectionString = process.env.DIRECT_URL;
if (!connectionString) throw new Error('DIRECT_URL is required for the admin bootstrap command.');

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
try {
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) throw new Error('An administrator with this email already exists.');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.adminUser.create({ data: { email, passwordHash, role: 'SUPER_ADMIN' } });
  console.log('Administrator created.');
} finally {
  await prisma.$disconnect();
}
