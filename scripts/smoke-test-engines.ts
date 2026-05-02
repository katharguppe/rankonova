/**
 * Smoke test: verifies ChatGPT and Gemini adapters end-to-end.
 * Requires: app running on localhost:3000, .env populated with real API keys.
 * Run: npx ts-node --require dotenv/register scripts/smoke-test-engines.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const BASE = 'http://localhost:3000';
const SMOKE_SLUG = 'smoke-eng-test';
const SMOKE_EMAIL = 'smoke-eng@aeo-suite-test.invalid';
const SMOKE_PASSWORD = 'SmokeTest1!';

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

async function poll(
  prisma: PrismaClient,
  runId: string,
  label: string,
  timeoutMs = 90_000,
  intervalMs = 3_000,
): Promise<{ status: string; rawResponse: string | null; errorMsg: string | null }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const run = await (prisma as any).promptRun.findUnique({
      where: { id: runId },
      select: { status: true, raw_response: true, error_message: true },
    });
    if (!run) throw new Error(`PromptRun ${runId} not found`);
    if (['completed', 'failed', 'dead_letter'].includes(run.status)) {
      return { status: run.status, rawResponse: run.raw_response, errorMsg: run.error_message };
    }
    console.log(`  [${label}] status=${run.status} — waiting...`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`[${label}] Timed out after ${timeoutMs / 1000}s`);
}

async function runEngine(
  prisma: PrismaClient,
  token: string,
  clientId: string,
  promptId: string,
  engine: string,
  stepLabel: string,
): Promise<void> {
  console.log(`\n[${stepLabel}a] Firing ${engine} run...`);
  const res = await api('POST', '/prompt-engine/run', { engines: [engine], clientId, promptId }, token);
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`${engine} trigger failed (${res.status}): ${JSON.stringify(res.data)}`);
  }
  const runIds: string[] = (res.data as any)?.runIds ?? [];
  if (!runIds.length) throw new Error(`No runIds in ${engine} response`);
  console.log(`    runId(s): ${runIds.join(', ')}`);

  console.log(`\n[${stepLabel}b] Polling ${engine} result...`);
  for (const runId of runIds) {
    const result = await poll(prisma, runId, engine);
    console.log(`\n  ── ${engine} result (runId=${runId}) ──`);
    console.log(`  status   : ${result.status}`);
    if (result.rawResponse) {
      const preview = result.rawResponse.slice(0, 500);
      const suffix = result.rawResponse.length > 500 ? ' [truncated]' : '';
      console.log(`  response : ${preview}${suffix}`);
    }
    if (result.errorMsg) console.log(`  error    : ${result.errorMsg}`);
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);
  await prisma.$connect();

  let cleanupTenantId: string | undefined;

  try {
    // ── Step 1: find first active prompt + any vertical ─────────────────────
    console.log('\n[1] Finding first active prompt and a vertical...');
    // Prompt.vertical_id is nullable; prefer one with a vertical, fall back to any prompt
    const prompt = await (prisma as any).prompt.findFirst({
      where: { is_active: true, vertical_id: { not: null } },
      select: { id: true, text: true, vertical: { select: { id: true, name: true } } },
      orderBy: { created_at: 'asc' },
    }) ?? await (prisma as any).prompt.findFirst({
      where: { is_active: true },
      select: { id: true, text: true },
      orderBy: { created_at: 'asc' },
    });
    if (!prompt) throw new Error('No active prompts found — run the seed first.');
    console.log(`    prompt.id=${prompt.id}  vertical=${prompt.vertical?.name ?? 'n/a'}`);

    // Find a vertical — from the prompt if attached, else any active vertical
    let verticalId: string = prompt.vertical?.id;
    if (!verticalId) {
      const anyVertical = await (prisma as any).vertical.findFirst({
        where: { is_active: true },
        select: { id: true, name: true },
        orderBy: { created_at: 'asc' },
      });
      if (!anyVertical) throw new Error('No active vertical found — run the seed first.');
      verticalId = anyVertical.id;
      console.log(`    Using vertical: ${anyVertical.name} (id=${anyVertical.id})`);
    }

    // ── Step 2: register (creates tenant+user atomically) ────────────────────
    console.log('\n[2] Cleaning up any leftover smoke data...');
    // Remove leftover user — delete dependents first to satisfy FK constraints
    const leftoverUser = await (prisma as any).user.findUnique({ where: { email: SMOKE_EMAIL }, select: { id: true } });
    if (leftoverUser) {
      await (prisma as any).refreshToken.deleteMany({ where: { user_id: leftoverUser.id } });
      await (prisma as any).authEvent.deleteMany({ where: { user_id: leftoverUser.id } });
      await (prisma as any).user.delete({ where: { id: leftoverUser.id } });
    }
    const leftoverTenant = await (prisma as any).tenant.findUnique({ where: { slug: SMOKE_SLUG } });
    if (leftoverTenant) {
      await (prisma as any).promptRun.deleteMany({ where: { client: { tenant_id: leftoverTenant.id } } });
      await (prisma as any).client.deleteMany({ where: { tenant_id: leftoverTenant.id } });
      await (prisma as any).tenant.delete({ where: { id: leftoverTenant.id } });
      console.log('    Removed leftover tenant from previous run.');
    }

    console.log('\n[3] Registering smoke user (creates tenant via register)...');
    const reg = await api('POST', '/auth/register', {
      email: SMOKE_EMAIL,
      password: SMOKE_PASSWORD,
      tenantName: 'Smoke Engine Test',
      tenantSlug: SMOKE_SLUG,
      billingEmail: SMOKE_EMAIL,
    });
    if (reg.status !== 201) throw new Error(`Register failed (${reg.status}): ${JSON.stringify(reg.data)}`);
    const verificationToken = (reg.data as any)?.verificationToken as string;
    if (!verificationToken) throw new Error('No verificationToken in register response');
    console.log('    Registered OK');

    // Verify email via API (clears Redis user_unverified key)
    const verify = await api('GET', `/auth/verify-email?token=${verificationToken}`);
    if (verify.status !== 200) throw new Error(`Email verify failed (${verify.status}): ${JSON.stringify(verify.data)}`);
    console.log('    Email verified OK');

    // Fetch the newly created tenant
    const tenant = await (prisma as any).tenant.findUnique({
      where: { slug: SMOKE_SLUG },
      select: { id: true },
    });
    if (!tenant) throw new Error('Could not find smoke tenant after registration');
    cleanupTenantId = tenant.id;
    console.log(`    tenant.id=${tenant.id}`);

    // ── Step 4: login ────────────────────────────────────────────────────────
    console.log('\n[4] Logging in...');
    const login = await api('POST', '/auth/login', { email: SMOKE_EMAIL, password: SMOKE_PASSWORD });
    if (login.status !== 200 && login.status !== 201) {
      throw new Error(`Login failed (${login.status}): ${JSON.stringify(login.data)}`);
    }
    const token = (login.data as any)?.accessToken as string;
    if (!token) throw new Error(`No accessToken in login response: ${JSON.stringify(login.data)}`);
    console.log('    Login OK, token obtained');

    // ── Step 5: create client directly in DB (required fields) ───────────────
    console.log('\n[5] Creating smoke client in DB...');
    const client = await (prisma as any).client.create({
      data: {
        tenant_id: tenant.id,
        vertical_id: verticalId,
        name: 'Smoke Client',
        brand_name: 'SmokeClient',
        aliases: ['SmokeClient'],
        city: 'TestCity',
        state: 'TestState',
        website_url: 'https://smoke-test.invalid',
        models: {},
        is_active: true,
      },
    });
    console.log(`    client.id=${client.id}`);

    // ── Steps 6–7: Perplexity run (via OpenRouter) ──────────────────────────
    await runEngine(prisma, token, client.id, prompt.id, 'perplexity', '6-7');

    // ── Steps 8–9: Claude run (via OpenRouter) ───────────────────────────────
    await runEngine(prisma, token, client.id, prompt.id, 'claude', '8-9');

    // ── Final summary ────────────────────────────────────────────────────────
    console.log('\n── Final prompt_runs for smoke client ──');
    const allRuns = await (prisma as any).promptRun.findMany({
      where: { client_id: client.id },
      select: { id: true, engine: true, status: true, cost_usd: true, error_message: true },
      orderBy: { created_at: 'asc' },
    });
    for (const r of allRuns) {
      const cost = r.cost_usd != null ? `$${Number(r.cost_usd).toFixed(6)}` : 'n/a';
      console.log(`  ${String(r.engine).padEnd(12)} | ${String(r.status).padEnd(12)} | cost=${cost} | id=${r.id}`);
      if (r.error_message) console.log(`    error: ${r.error_message}`);
    }
    const allPassed = allRuns.every((r: any) => r.status === 'completed');
    console.log(`\n${allPassed ? '[PASS]' : '[WARN]'} ${allRuns.length} run(s) processed.`);

  } finally {
    // ── Cleanup ──────────────────────────────────────────────────────────────
    console.log('\n[cleanup] Removing smoke test data...');
    if (cleanupTenantId) {
      await (prisma as any).promptRun.deleteMany({ where: { client: { tenant_id: cleanupTenantId } } });
      await (prisma as any).client.deleteMany({ where: { tenant_id: cleanupTenantId } });
      // Delete refresh tokens before users (FK constraint)
      const smokeUsers = await (prisma as any).user.findMany({
        where: { tenant_id: cleanupTenantId },
        select: { id: true },
      });
      const userIds = smokeUsers.map((u: any) => u.id);
      if (userIds.length) {
        await (prisma as any).refreshToken.deleteMany({ where: { user_id: { in: userIds } } });
        await (prisma as any).authEvent.deleteMany({ where: { user_id: { in: userIds } } });
      }
      await (prisma as any).user.deleteMany({ where: { tenant_id: cleanupTenantId } });
      await (prisma as any).tenant.delete({ where: { id: cleanupTenantId } }).catch(() => {});
    }
    console.log('    Done.');
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('\n[SMOKE TEST FAILED]', e.message ?? e);
  process.exit(1);
});
