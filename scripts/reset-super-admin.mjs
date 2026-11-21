import 'dotenv/config';
import { stdin, stdout } from 'node:process';
import argon2 from 'argon2';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const MIN_PASSWORD_LENGTH = 12;

function readHidden(question) {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error('Run this command from an interactive terminal.');
  }

  return new Promise((resolve, reject) => {
    let value = '';
    let settled = false;

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
    };

    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      cleanup();
      stdout.write('\n');
      if (error) reject(error);
      else resolve(result);
    };

    const onData = (chunk) => {
      for (const character of chunk.toString()) {
        if (character === '\u0003') {
          finish(new Error('Password reset cancelled.'));
          return;
        }

        if (character === '\r' || character === '\n') {
          finish(null, value);
          return;
        }

        if (character === '\u007f') {
          value = value.slice(0, -1);
          continue;
        }

        value += character;
      }
    };

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  throw new Error('DIRECT_URL is required for the password reset command.');
}

const password = await readHidden('New password: ');
if (password.length < MIN_PASSWORD_LENGTH) {
  throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
}

const confirmation = await readHidden('Confirm new password: ');
if (password !== confirmation) {
  throw new Error('Passwords do not match.');
}

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

try {
  const activeSuperAdmins = await prisma.adminUser.findMany({
    where: { role: 'SUPER_ADMIN', isActive: true },
    select: { id: true },
  });

  if (activeSuperAdmins.length === 0) {
    throw new Error('No active SUPER_ADMIN account was found.');
  }

  if (activeSuperAdmins.length > 1) {
    throw new Error('Multiple active SUPER_ADMIN accounts were found; refusing an ambiguous reset.');
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const adminId = activeSuperAdmins[0].id;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.adminUser.updateMany({
      where: { id: adminId, role: 'SUPER_ADMIN', isActive: true },
      data: { passwordHash },
    });

    if (updated.count !== 1) {
      throw new Error('The selected active SUPER_ADMIN account changed; no password was reset.');
    }

    await tx.adminSession.updateMany({
      where: { adminUserId: adminId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  const updatedAdmin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { passwordHash: true },
  });

  if (!updatedAdmin || !(await argon2.verify(updatedAdmin.passwordHash, password))) {
    throw new Error('Password reset verification failed.');
  }

  console.log('Password reset succeeded for the existing active SUPER_ADMIN account.');
  console.log('All existing sessions for that account were revoked.');
} finally {
  await prisma.$disconnect();
}
