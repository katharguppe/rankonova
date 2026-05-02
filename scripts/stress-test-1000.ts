/**
 * Phase 3 Exit Criteria: 1000-run stress test via Claude/OpenRouter.
 * 100 batches of 10 jobs, 65-second inter-batch wait.
 * All records kept in prompt_runs table. No cleanup at end.
 *
 * Run: npx ts-node scripts/stress-test-1000.ts
 * Expected duration: ~110 minutes
 * Expected cost: ~$5 USD (OpenRouter Claude)
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ override: true });

const BASE = 'http://localhost:3000';
const STRESS_SLUG = 'stress-1000';
const STRESS_EMAIL = 'stress-1000@aeo-suite-test.invalid';
const STRESS_PASSWORD = 'StressTest1!';
const BATCH_SIZE = 10;
const BATCHES = 100;
const INTER_BATCH_MS = 65_000;
const POLL_INTERVAL_MS = 10_000;
const POST_QUEUE_POLL_TIMEOUT_MS = 20 * 60_000; // 20 min for tail-end runs to finish

const TERMINAL = new Set(['completed', 'failed', 'dead_letter']);

function ts() {
  return new Date().toISOString().slice(11, 19); // HH:MM:SS
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function api(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: unknown;
  try { data = await res.json(); } catch { data = await res.text(); }
  return { status: res.status, data };
}

async function main() {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);
  await prisma.$connect();

  const startTime = Date.now();
  console.log(`\n[${ts()}] ═══════════════════════════════════════════════════`);
  console.log(`[${ts()}] Phase 3 Exit Criteria: 1000-run stress test`);
  console.log(`[${ts()}] ${BATCHES} batches × ${BATCH_SIZE} jobs, ${INTER_BATCH_MS / 1000}s inter-batch wait`);
  console.log(`[${ts()}] ═══════════════════════════════════════════════════\n`);

  // ── Step 1: Pre-cleanup any leftover stress data ────────────────────────────
  console.log(`[${ts()}] [1] Pre-cleanup stress-1000 tenant...`);
  const leftoverTenant = await (prisma as any).tenant.findUnique({
    where: { slug: STRESS_SLUG },
    select: { id: true },
  });
  if (leftoverTenant) {
    const users = await (prisma as any).user.findMany({
      where: { tenant_id: leftoverTenant.id },
      select: { id: true },
    });
    const userIds = users.map((u: any) => u.id);
    if (userIds.length) {
      await (prisma as any).authEvent.deleteMany({ where: { user_id: { in: userIds } } });
      await (prisma as any).refreshToken.deleteMany({ where: { user_id: { in: userIds } } });
    }
    await (prisma as any).promptRun.deleteMany({ where: { client: { tenant_id: leftoverTenant.id } } });
    await (prisma as any).client.deleteMany({ where: { tenant_id: leftoverTenant.id } });
    await (prisma as any).user.deleteMany({ where: { tenant_id: leftoverTenant.id } });
    await (prisma as any).tenant.delete({ where: { id: leftoverTenant.id } });
    console.log(`    Removed leftover tenant.`);
  } else {
    console.log(`    No leftover data.`);
  }

  // ── Step 2: Find an active prompt ─────────────────────────────────────────
  console.log(`\n[${ts()}] [2] Finding active prompt...`);
  const prompt = await (prisma as any).prompt.findFirst({
    where: { is_active: true },
    select: { id: true, text: true },
    orderBy: { created_at: 'asc' },
  });
  if (!prompt) throw new Error('No active prompts in DB. Run the seed first.');
  console.log(`    prompt.id=${prompt.id}`);
  console.log(`    text: ${prompt.text.slice(0, 80)}${prompt.text.length > 80 ? '...' : ''}`);

  // ── Step 3: Register tenant+user ───────────────────────────────────────────
  console.log(`\n[${ts()}] [3] Registering stress tenant...`);
  const reg = await api('POST', '/auth/register', {
    email: STRESS_EMAIL,
    password: STRESS_PASSWORD,
    tenantName: 'Stress Test 1000',
    tenantSlug: STRESS_SLUG,
    billingEmail: STRESS_EMAIL,
  });
  if (reg.status !== 201) throw new Error(`Register failed (${reg.status}): ${JSON.stringify(reg.data)}`);
  const verificationToken = (reg.data as any)?.verificationToken as string;
  if (!verificationToken) throw new Error('No verificationToken in register response');

  // ── Step 4: Verify email ──────────────────────────────────────────────────
  const verify = await api('GET', `/auth/verify-email?token=${verificationToken}`);
  if (verify.status !== 200) throw new Error(`Email verify failed (${verify.status}): ${JSON.stringify(verify.data)}`);
  console.log(`    Tenant registered + email verified.`);

  // ── Step 5: Login ─────────────────────────────────────────────────────────
  console.log(`\n[${ts()}] [4] Logging in...`);
  const login = await api('POST', '/auth/login', { email: STRESS_EMAIL, password: STRESS_PASSWORD });
  if (login.status !== 200 && login.status !== 201) {
    throw new Error(`Login failed (${login.status}): ${JSON.stringify(login.data)}`);
  }
  const token = (login.data as any)?.accessToken as string;
  if (!token) throw new Error('No accessToken in login response');
  console.log(`    Login OK.`);

  // ── Step 6: Create client ─────────────────────────────────────────────────
  console.log(`\n[${ts()}] [5] Creating stress client in DB...`);
  const tenant = await (prisma as any).tenant.findUnique({
    where: { slug: STRESS_SLUG },
    select: { id: true },
  });
  if (!tenant) throw new Error('Stress tenant not found after registration');

  // Find any active vertical for the client
  const anyVertical = await (prisma as any).vertical.findFirst({
    where: { is_active: true },
    select: { id: true, name: true },
    orderBy: { created_at: 'asc' },
  });
  if (!anyVertical) throw new Error('No active vertical found — run the seed first.');

  const client = await (prisma as any).client.create({
    data: {
      tenant_id: tenant.id,
      vertical_id: anyVertical.id,
      name: 'Stress Test Client',
      brand_name: 'StressClient',
      aliases: ['StressClient'],
      city: 'TestCity',
      state: 'TestState',
      website_url: 'https://stress-test.invalid',
      models: {},
      is_active: true,
    },
  });
  console.log(`    client.id=${client.id}  vertical=${anyVertical.name}`);

  // ── Step 7: Queue 1000 runs in 100 batches ────────────────────────────────
  console.log(`\n[${ts()}] [6] Starting load: ${BATCHES} batches × ${BATCH_SIZE} = ${BATCHES * BATCH_SIZE} runs`);
  console.log(`    Inter-batch delay: ${INTER_BATCH_MS / 1000}s  |  Estimated duration: ~${Math.ceil(BATCHES * INTER_BATCH_MS / 60_000)} min\n`);

  const allRunIds: string[] = [];
  let batchFailures = 0;

  for (let batch = 1; batch <= BATCHES; batch++) {
    const batchRunIds: string[] = [];
    const batchErrors: string[] = [];

    // Fire BATCH_SIZE requests as fast as possible
    const fires = Array.from({ length: BATCH_SIZE }, (_, i) =>
      api('POST', '/prompt-engine/run', {
        clientId: client.id,
        promptId: prompt.id,
        engines: ['gemini'],
      }, token).then((res) => {
        if (res.status === 200 || res.status === 201) {
          const ids: string[] = (res.data as any)?.runIds ?? [];
          batchRunIds.push(...ids);
        } else {
          batchErrors.push(`job ${i + 1}: HTTP ${res.status} — ${JSON.stringify(res.data)}`);
        }
      }).catch((err: Error) => {
        batchErrors.push(`job ${i + 1}: ${err.message}`);
      }),
    );

    await Promise.all(fires);
    allRunIds.push(...batchRunIds);
    batchFailures += batchErrors.length;

    const total = allRunIds.length;
    const pct = Math.round(total / (BATCHES * BATCH_SIZE) * 100);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(
      `[${ts()}] Batch ${String(batch).padStart(3)}/${BATCHES} ` +
      `| queued ${String(batchRunIds.length).padStart(2)}/${BATCH_SIZE} ` +
      `| total=${total} (${pct}%) ` +
      `| errors=${batchErrors.length} ` +
      `| elapsed=${elapsed}s`,
    );
    if (batchErrors.length) {
      for (const e of batchErrors) console.log(`    ERROR: ${e}`);
    }

    // Wait between batches (skip wait after last batch)
    if (batch < BATCHES) {
      await sleep(INTER_BATCH_MS);
    }
  }

  console.log(`\n[${ts()}] All ${allRunIds.length} runs queued. ${batchFailures} queue-time errors.`);

  // ── Step 8: Poll until all runs reach terminal state ──────────────────────
  console.log(`\n[${ts()}] [7] Polling ${allRunIds.length} runs for completion (timeout ${POST_QUEUE_POLL_TIMEOUT_MS / 60_000} min)...\n`);

  const pending = new Set(allRunIds);
  const results: Record<string, { status: string; costUsd: number | null }> = {};
  const pollDeadline = Date.now() + POST_QUEUE_POLL_TIMEOUT_MS;

  while (pending.size > 0 && Date.now() < pollDeadline) {
    const ids = [...pending];
    const rows = await (prisma as any).promptRun.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true, cost_usd: true },
    });

    for (const row of rows) {
      if (TERMINAL.has(row.status)) {
        pending.delete(row.id);
        results[row.id] = { status: row.status, costUsd: row.cost_usd };
      }
    }

    const done = allRunIds.length - pending.size;
    const pct = Math.round(done / allRunIds.length * 100);
    console.log(`[${ts()}] Completed: ${done}/${allRunIds.length} (${pct}%) | Pending: ${pending.size}`);

    if (pending.size > 0) await sleep(POLL_INTERVAL_MS);
  }

  if (pending.size > 0) {
    console.log(`\n[${ts()}] WARNING: ${pending.size} runs still pending after poll timeout — marking as unknown.`);
    for (const id of pending) {
      results[id] = { status: 'timeout', costUsd: null };
    }
  }

  // ── Step 9: Final report ──────────────────────────────────────────────────
  const counts: Record<string, number> = {};
  let totalCostUsd = 0;

  for (const r of Object.values(results)) {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
    if (r.costUsd != null) totalCostUsd += Number(r.costUsd);
  }

  // Cross-check cost via Redis cost tracker
  let redisCostUsd: number | null = null;
  try {
    const costRes = await api('GET', '/prompt-engine/cost', undefined, token);
    if (costRes.status === 200) {
      redisCostUsd = (costRes.data as any)?.costUsd ?? null;
    }
  } catch { /* non-fatal */ }

  const totalSeconds = Math.round((Date.now() - startTime) / 1000);
  const totalMinutes = (totalSeconds / 60).toFixed(1);

  console.log(`\n[${ts()}] ═══════════════════════════════════════════════════`);
  console.log(`[${ts()}] PHASE 3 EXIT CRITERIA — FINAL REPORT`);
  console.log(`[${ts()}] ═══════════════════════════════════════════════════`);
  console.log(`  Total runs queued   : ${allRunIds.length}`);
  console.log(`  Queue-time errors   : ${batchFailures}`);
  for (const [status, count] of Object.entries(counts).sort()) {
    console.log(`  ${status.padEnd(18)}: ${count}`);
  }
  const completed = counts['completed'] ?? 0;
  const failed = (counts['failed'] ?? 0) + (counts['dead_letter'] ?? 0) + (counts['timeout'] ?? 0);
  const successRate = allRunIds.length > 0 ? ((completed / allRunIds.length) * 100).toFixed(2) : '0.00';
  console.log(`  ─────────────────────────────────────────────`);
  console.log(`  Success rate        : ${successRate}%`);
  console.log(`  Cost (prompt_runs)  : $${totalCostUsd.toFixed(6)}`);
  if (redisCostUsd != null) {
    console.log(`  Cost (Redis tracker): $${Number(redisCostUsd).toFixed(6)}`);
    const drift = Math.abs(totalCostUsd - Number(redisCostUsd));
    console.log(`  Cost drift          : $${drift.toFixed(6)} ${drift < 0.001 ? '(accurate)' : '(drift detected)'}`);
  }
  console.log(`  Total duration      : ${totalMinutes} min (${totalSeconds}s)`);
  console.log(`  Tenant              : ${STRESS_SLUG}`);
  console.log(`  Client ID           : ${client.id}`);
  console.log(`  Records kept in DB  : YES (prompt_runs not deleted)`);
  console.log(`[${ts()}] ═══════════════════════════════════════════════════`);

  if (completed >= 999) {
    console.log(`\n[${ts()}] [PASS] Exit criteria MET: ${completed}/1000 runs completed without failure.`);
  } else if (completed >= 950) {
    console.log(`\n[${ts()}] [WARN] ${completed}/1000 completed. Failure rate ${(100 - Number(successRate)).toFixed(2)}% — investigate before shipping.`);
  } else {
    console.log(`\n[${ts()}] [FAIL] Only ${completed}/1000 completed. Pipeline needs investigation.`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error('\n[STRESS TEST ABORTED]', e.message ?? e);
  process.exit(1);
});
