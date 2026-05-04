/**
 * Smoke test: community presence monitor -- triggers runForClient, list
 * threads, opportunity filter, draft regeneration, mark posted/skipped,
 * and auth guard. Writes smoke-results-community.json.
 *
 * Requires: app running on localhost:3000, .env populated.
 * Run: npx ts-node scripts/smoke-test-community.ts
 */

import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ override: true });

const BASE = 'http://localhost:3000';
const DEMO_EMAIL = 'demo@aeo-suite.local';
const DEMO_PASSWORD = 'Demo@2026!';
const STRESS_CLIENT_ID = 'cmonwtk9r00002ku9q59ge1h4';

interface ApiResult { status: number; data: unknown }

async function api(
  path: string,
  options: { method?: string; token?: string } = {},
): Promise<ApiResult> {
  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
  });
  let data: unknown;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

async function login(): Promise<string> {
  const r = await api('/auth/login', { method: 'POST' });
  // need to send body — rebuild with fetch directly
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });
  const d = await res.json() as { accessToken?: string };
  if (!d.accessToken) throw new Error(`Login failed: ${res.status} ${JSON.stringify(d)}`);
  console.log('[smoke] Login OK');
  return d.accessToken;
}

async function main() {
  const report: {
    timestamp: string;
    run_result: unknown;
    threads_result: unknown;
    opportunities_result: unknown;
    draft_result: unknown;
    posted_result: unknown;
    skipped_result: unknown;
    errors: string[];
    summary: { total_threads: number; opportunities: number; with_draft: number };
  } = {
    timestamp: new Date().toISOString(),
    run_result: null, threads_result: null, opportunities_result: null,
    draft_result: null, posted_result: null, skipped_result: null,
    errors: [],
    summary: { total_threads: 0, opportunities: 0, with_draft: 0 },
  };

  let token: string;
  try { token = await login(); }
  catch (err) { report.errors.push((err as Error).message); writeReport(report); process.exit(1); return; }

  // 1. POST /run
  console.log(`[smoke] POST /offsite/community/${STRESS_CLIENT_ID}/run ...`);
  console.log('[smoke] NOTE: Reddit JSON API calls with 500ms delay between requests.');
  const runR = await api(`/offsite/community/${STRESS_CLIENT_ID}/run`, { method: 'POST', token });
  report.run_result = runR.data;
  if (runR.status !== 200 && runR.status !== 201) {
    report.errors.push(`run failed: ${runR.status} ${JSON.stringify(runR.data)}`);
    console.error('[smoke] run failed:', runR.status);
  } else {
    const threads = runR.data as Array<{
      id: string; thread_title: string; is_competitor_recommended: boolean;
      is_client_mentioned: boolean; response_draft: string | null; thread_score: number;
    }>;
    report.summary.total_threads = threads.length;
    report.summary.opportunities = threads.filter(
      (t) => t.is_competitor_recommended && !t.is_client_mentioned,
    ).length;
    report.summary.with_draft = threads.filter((t) => t.response_draft).length;
    console.log(`[smoke] run OK — ${threads.length} new thread(s) found`);
    console.log(`  Opportunities: ${report.summary.opportunities}`);
    console.log(`  With draft:    ${report.summary.with_draft}`);
    for (const t of threads.slice(0, 3)) {
      console.log(`  "${t.thread_title.slice(0, 70)}" score=${t.thread_score} comp=${t.is_competitor_recommended} client=${t.is_client_mentioned}`);
    }
  }

  // 2. GET /threads
  console.log(`[smoke] GET /offsite/community/${STRESS_CLIENT_ID}/threads ...`);
  const threadsR = await api(`/offsite/community/${STRESS_CLIENT_ID}/threads`, { token });
  report.threads_result = threadsR.data;
  if (threadsR.status !== 200) {
    report.errors.push(`threads failed: ${threadsR.status}`);
    console.error('[smoke] threads failed:', threadsR.status);
  } else {
    const threads = threadsR.data as Array<{ id: string }>;
    console.log(`[smoke] threads OK — ${threads.length} total thread(s)`);
  }

  // 3. GET /threads?opportunities_only=true
  console.log(`[smoke] GET /offsite/community/${STRESS_CLIENT_ID}/threads?opportunities_only=true ...`);
  const opR = await api(
    `/offsite/community/${STRESS_CLIENT_ID}/threads?opportunities_only=true`, { token },
  );
  report.opportunities_result = opR.data;
  if (opR.status !== 200) {
    report.errors.push(`opportunities failed: ${opR.status}`);
    console.error('[smoke] opportunities failed:', opR.status);
  } else {
    const opThreads = opR.data as Array<{
      id: string; thread_title: string; response_draft: string | null; response_status: string;
    }>;
    console.log(`[smoke] opportunities OK — ${opThreads.length} opportunity thread(s)`);

    if (opThreads.length > 0) {
      const first = opThreads[0];

      // 4. POST /thread/:id/draft
      console.log(`[smoke] POST /offsite/community/thread/${first.id}/draft ...`);
      const draftR = await api(`/offsite/community/thread/${first.id}/draft`, { method: 'POST', token });
      report.draft_result = draftR.data;
      if (draftR.status !== 200) {
        report.errors.push(`draft failed: ${draftR.status}`);
        console.error('[smoke] draft failed:', draftR.status);
      } else {
        const snap = draftR.data as { response_draft: string };
        console.log(`[smoke] draft OK — ${snap.response_draft?.length ?? 0} chars`);
        console.log(`  Draft: "${snap.response_draft?.slice(0, 80)}..."`);
      }

      // 5. PATCH /thread/:id/posted (use second thread if available, else same)
      const toPost = opThreads.length > 1 ? opThreads[1] : opThreads[0];
      console.log(`[smoke] PATCH /offsite/community/thread/${toPost.id}/posted ...`);
      const postedR = await api(`/offsite/community/thread/${toPost.id}/posted`, { method: 'PATCH', token });
      report.posted_result = postedR.data;
      if (postedR.status !== 200) {
        report.errors.push(`posted failed: ${postedR.status}`);
        console.error('[smoke] posted failed:', postedR.status);
      } else {
        const t = postedR.data as { response_status: string; responded_at: string };
        console.log(`[smoke] posted OK — status=${t.response_status}, responded_at=${t.responded_at}`);
      }

      // 6. PATCH /thread/:id/skipped (use third or first)
      const toSkip = opThreads.length > 2 ? opThreads[2] : opThreads[0];
      if (toSkip.id !== toPost.id || opThreads.length === 1) {
        console.log(`[smoke] PATCH /offsite/community/thread/${toSkip.id}/skipped ...`);
        const skippedR = await api(`/offsite/community/thread/${toSkip.id}/skipped`, { method: 'PATCH', token });
        report.skipped_result = skippedR.data;
        if (skippedR.status !== 200) {
          report.errors.push(`skipped failed: ${skippedR.status}`);
          console.error('[smoke] skipped failed:', skippedR.status);
        } else {
          const t = skippedR.data as { response_status: string };
          console.log(`[smoke] skipped OK — status=${t.response_status}`);
        }
      }
    } else {
      console.log('[smoke] No opportunity threads found — skipping draft/posted/skipped tests');
    }
  }

  // 7. Auth guard
  const guardR = await api(`/offsite/community/${STRESS_CLIENT_ID}/threads`);
  if (guardR.status === 401) {
    console.log('[smoke] Auth guard OK — 401 on unauthenticated request');
  } else {
    report.errors.push(`Auth guard FAILED: expected 401, got ${guardR.status}`);
    console.error('[smoke] Auth guard FAILED:', guardR.status);
  }

  writeReport(report);
  const pass = report.errors.length === 0;
  console.log(`\n[smoke] ${pass ? 'PASS' : 'FAIL'}`);
  if (!pass) {
    for (const e of report.errors) console.error(' ', e);
    process.exit(1);
  }
}

function writeReport(report: unknown) {
  fs.writeFileSync('smoke-results-community.json', JSON.stringify(report, null, 2));
  console.log('[smoke] Report written to smoke-results-community.json');
}

main();
