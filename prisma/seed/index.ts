import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

import { seedPrompts } from './prompts.seed';

// Verticals have a standalone runner: ts-node prisma/seed/verticals.seed.ts
// This index runs remaining seeds that use the shared client pattern.

async function main() {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$connect();
    console.log('Seeding prompts...');
    await seedPrompts(prisma);
    console.log('All seeds complete.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
