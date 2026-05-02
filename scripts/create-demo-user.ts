/**
 * Creates a demo user for dashboard testing.
 * Looks up the tenant that owns the stress client directly by client ID,
 * so the demo user is guaranteed to be in the same tenant as the existing data.
 * No Redis key is set, so login treats the account as already verified.
 *
 * Run: npx ts-node scripts/create-demo-user.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcryptjs';

dotenv.config({ override: true });

const DEMO_EMAIL = 'demo@aeo-suite.local';
const DEMO_PASSWORD = 'Demo@2026!';
// Anchor on the known stress client — guarantees same tenant as real data
const STRESS_CLIENT_ID = 'cmonwtk9r00002ku9q59ge1h4';

async function main() {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$connect();

    // Find tenant via the known client — no slug guessing
    const client = await prisma.client.findUnique({
      where: { id: STRESS_CLIENT_ID },
      select: { tenant_id: true, brand_name: true },
    });
    if (!client) {
      throw new Error(`Client ${STRESS_CLIENT_ID} not found — is the stress test data present?`);
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: client.tenant_id } });
    if (!tenant) throw new Error(`Tenant ${client.tenant_id} not found`);

    console.log(`Tenant: ${tenant.name} (${tenant.slug}) — id: ${tenant.id}`);
    console.log(`Client: ${client.brand_name} (${STRESS_CLIENT_ID})`);

    // Idempotent: remove any existing demo user first (FK order: tokens → events → user)
    const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
    if (existing) {
      await prisma.refreshToken.deleteMany({ where: { user_id: existing.id } });
      await prisma.authEvent.deleteMany({ where: { user_id: existing.id } });
      await prisma.user.delete({ where: { email: DEMO_EMAIL } });
      console.log('Removed previous demo user');
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const user = await prisma.user.create({
      data: {
        tenant_id: tenant.id,
        email: DEMO_EMAIL,
        password_hash: passwordHash,
        role: 'tenant_admin',
        is_active: true,
      },
    });

    console.log('\n=== Demo user ready ===');
    console.log(`  Email:     ${DEMO_EMAIL}`);
    console.log(`  Password:  ${DEMO_PASSWORD}`);
    console.log(`  Tenant:    ${tenant.name} (${tenant.slug})`);
    console.log(`  User ID:   ${user.id}`);
    console.log(`\n  Dashboard: http://localhost:3001/dashboard/${STRESS_CLIENT_ID}/overview`);
    console.log('  No email verification needed — account is active immediately.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
