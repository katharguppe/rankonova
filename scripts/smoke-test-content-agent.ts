/**
 * Smoke test: content-agent — generates 10 pieces across all 4 content types,
 * exercises approval workflow, writes results to smoke-results-content-agent.json.
 *
 * Requires: app running on localhost:3000, .env populated.
 * Run: npx ts-node --require dotenv/register scripts/smoke-test-content-agent.ts
 */

import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ override: true });

const BASE = 'http://localhost:3000';
const DEMO_EMAIL = 'demo@aeo-suite.local';
const DEMO_PASSWORD = 'Demo@2026!';
const STRESS_CLIENT_ID = 'cmonwtk9r00002ku9q59ge1h4';

// 10 pieces: 3 faq, 3 comparison, 2 entity_authority, 2 segment_article
const GENERATION_PLAN = [
  { contentType: 'faq_page' },
  { contentType: 'faq_page' },
  { contentType: 'faq_page' },
  { contentType: 'comparison_page' },
  { contentType: 'comparison_page' },
  { contentType: 'comparison_page' },
  { contentType: 'entity_authority_page' },
  { contentType: 'entity_authority_page' },
  { contentType: 'segment_article' },
  { contentType: 'segment_article' },
];

interface ApiResult {
  status: number;
  data: unknown;
}

interface PieceResult {
  index: number;
  contentType: string;
  outputId: string | null;
  title: string | null;
  status: string | null;
  validationIssues: number;
  httpStatus: number;
  error?: string;
}

async function api(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<ApiResult> {
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

function countIssues(output: any): number {
  if (!output?.review_notes) return 0;
  const match = (output.review_notes as string).match(/^(\d+) validation issue/);
  return match ? parseInt(match[1], 10) : 0;
}

async function main() {
  const results: PieceResult[] = [];
  const generatedIds: string[] = [];
  let token: string;

  // ── Step 1: login ─────────────────────────────────────────────────────────
  console.log('[1] Logging in with demo credentials...');
  const login = await api('POST', '/auth/login', {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (login.status !== 200 && login.status !== 201) {
    throw new Error(`Login failed (${login.status}): ${JSON.stringify(login.data)}`);
  }
  token = (login.data as any)?.accessToken as string;
  if (!token) throw new Error(`No accessToken: ${JSON.stringify(login.data)}`);
  console.log('    Login OK\n');

  // ── Step 2: generate 10 pieces ────────────────────────────────────────────
  console.log('[2] Generating 10 content pieces...');
  for (let i = 0; i < GENERATION_PLAN.length; i++) {
    const { contentType } = GENERATION_PLAN[i];
    process.stdout.write(`    [${i + 1}/10] ${contentType.padEnd(22)} ... `);

    const res = await api(
      'POST',
      '/content/generate',
      { clientId: STRESS_CLIENT_ID, contentType },
      token,
    );

    const output = res.data as any;
    const outputId: string | null = output?.id ?? null;
    const title: string | null = output?.title ?? null;
    const outputStatus: string | null = output?.status ?? null;
    const issues = countIssues(output);

    const pieceResult: PieceResult = {
      index: i + 1,
      contentType,
      outputId,
      title,
      status: outputStatus,
      validationIssues: issues,
      httpStatus: res.status,
    };

    if (res.status === 201 && outputId) {
      generatedIds.push(outputId);
      console.log(`OK  id=${outputId.slice(0, 8)}… issues=${issues}`);
    } else {
      pieceResult.error = JSON.stringify(output).slice(0, 200);
      console.log(`FAIL (${res.status}) ${pieceResult.error}`);
    }

    results.push(pieceResult);

    // Small delay to avoid hammering the LLM endpoint
    await new Promise((r) => setTimeout(r, 1_000));
  }

  const generated = results.filter((r) => r.httpStatus === 201);
  console.log(`\n    Generated: ${generated.length}/10\n`);

  // ── Step 3: approval workflow test ────────────────────────────────────────
  console.log('[3] Testing approval workflow...');

  const workflowResults: Record<string, unknown> = {};

  if (generatedIds.length >= 2) {
    // Approve piece #1
    const approveId = generatedIds[0];
    console.log(`    Approving output ${approveId.slice(0, 8)}...`);
    const approveRes = await api('PATCH', `/content/output/${approveId}/approve`, undefined, token);
    workflowResults['approve'] = { status: approveRes.status, newStatus: (approveRes.data as any)?.status };
    console.log(`    Approve => HTTP ${approveRes.status}, status="${(approveRes.data as any)?.status}"`);

    // Publish piece #1
    console.log(`    Publishing output ${approveId.slice(0, 8)}...`);
    const publishRes = await api('PATCH', `/content/output/${approveId}/publish`, undefined, token);
    workflowResults['publish'] = { status: publishRes.status, newStatus: (publishRes.data as any)?.status };
    console.log(`    Publish => HTTP ${publishRes.status}, status="${(publishRes.data as any)?.status}"`);

    // Request revision on piece #2
    const revisionId = generatedIds[1];
    const reviewNotes = 'Please add more specific pricing details and a stronger call to action in the closing paragraph.';
    console.log(`    Requesting revision on ${revisionId.slice(0, 8)}...`);
    const revisionRes = await api(
      'PATCH',
      `/content/output/${revisionId}/request-revision`,
      { reviewNotes },
      token,
    );
    workflowResults['requestRevision'] = { status: revisionRes.status, newStatus: (revisionRes.data as any)?.status };
    console.log(`    Revision => HTTP ${revisionRes.status}, status="${(revisionRes.data as any)?.status}"`);

    // Regenerate piece #2
    if (revisionRes.status === 200) {
      console.log(`    Regenerating ${revisionId.slice(0, 8)}...`);
      const regenRes = await api('POST', `/content/output/${revisionId}/regenerate`, undefined, token);
      const regenId = (regenRes.data as any)?.id ?? null;
      workflowResults['regenerate'] = {
        status: regenRes.status,
        newOutputId: regenId,
        previousVersionId: (regenRes.data as any)?.previous_version_id,
      };
      console.log(`    Regen => HTTP ${regenRes.status}, new id=${regenId?.slice(0, 8) ?? 'n/a'}`);
      if (regenId) generatedIds.push(regenId);
    }
  }

  // ── Step 4: invalid transition guard test ─────────────────────────────────
  console.log('\n[4] Testing state machine guard (publish unpublished draft)...');
  if (generatedIds.length >= 3) {
    const guardId = generatedIds[2]; // still in draft
    const guardRes = await api('PATCH', `/content/output/${guardId}/publish`, undefined, token);
    const guardPassed = guardRes.status === 400;
    workflowResults['guardTest'] = {
      expectedStatus: 400,
      actualStatus: guardRes.status,
      passed: guardPassed,
    };
    console.log(`    Guard => HTTP ${guardRes.status} (expected 400) — ${guardPassed ? 'PASS' : 'FAIL'}`);
  }

  // ── Step 5: list outputs ──────────────────────────────────────────────────
  console.log('\n[5] Listing content outputs for stress client...');
  const listRes = await api('GET', `/content/${STRESS_CLIENT_ID}`, undefined, token);
  const listCount = Array.isArray(listRes.data) ? (listRes.data as unknown[]).length : 'n/a';
  console.log(`    List => HTTP ${listRes.status}, total outputs=${listCount}`);

  // ── Step 6: cleanup generated outputs ─────────────────────────────────────
  console.log('\n[6] Cleaning up generated outputs via DB is not done here.');
  console.log('    Generated outputs remain for manual review (they belong to stress client).');

  // ── Final report ──────────────────────────────────────────────────────────
  const allPassed = generated.length === 10;
  const hasErrors = results.some((r) => r.httpStatus !== 201);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' SMOKE TEST RESULTS — content-agent');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Generated: ${generated.length}/10`);
  console.log(`  Errors:    ${results.filter((r) => r.httpStatus !== 201).length}`);
  console.log('');
  console.log('  Index  Type                    HTTP  Issues  ID');
  console.log('  ─────  ──────────────────────  ────  ──────  ──────────────');
  for (const r of results) {
    const id = r.outputId ? r.outputId.slice(0, 12) + '...' : 'n/a';
    console.log(
      `  ${String(r.index).padStart(5)}  ${r.contentType.padEnd(22)}  ${String(r.httpStatus).padStart(4)}  ` +
      `${String(r.validationIssues).padStart(6)}  ${id}`,
    );
  }
  console.log('');
  console.log('  Workflow:');
  for (const [k, v] of Object.entries(workflowResults)) {
    console.log(`    ${k.padEnd(18)}: ${JSON.stringify(v)}`);
  }
  console.log('');
  console.log(`  Overall: ${allPassed && !hasErrors ? '[PASS]' : '[PARTIAL/FAIL]'}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Write JSON report
  const reportPath = 'smoke-results-content-agent.json';
  const report = {
    runAt: new Date().toISOString(),
    summary: { generated: generated.length, total: 10, errors: hasErrors },
    pieces: results,
    workflow: workflowResults,
    listOutputsCount: listCount,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`  Report written to ${reportPath}`);

  if (!allPassed) process.exit(1);
}

main().catch((e) => {
  console.error('\n[SMOKE TEST FAILED]', (e as Error).message ?? e);
  process.exit(1);
});
