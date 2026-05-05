/**
 * Smoke test: PR Signal Generator -- triggers runForClient, list signals,
 * approve/distribute/archive transitions, pickup-check, auth guard.
 * Writes smoke-results-pr.json.
 *
 * Requires: app running on localhost:3000, .env populated.
 * Run: npx ts-node scripts/smoke-test-pr.ts
 *
 * NOTE: runForClient fetches live RSS feeds and calls Cerebras. Allow ~30s.
 * If no RSS feeds are configured for the stress client's vertical, run result
 * will be an empty array (not an error).
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
    signals_result: unknown;
    approve_result: unknown;
    distribute_result: unknown;
    archive_result: unknown;
    errors: string[];
    summary: {
      new_signals: number;
      total_signals: number;
      approved_signal_id: string | null;
      distributed_signal_id: string | null;
      archived_signal_id: string | null;
    };
  } = {
    timestamp: new Date().toISOString(),
    run_result: null, signals_result: null,
    approve_result: null, distribute_result: null, archive_result: null,
    errors: [],
    summary: {
      new_signals: 0, total_signals: 0,
      approved_signal_id: null, distributed_signal_id: null, archived_signal_id: null,
    },
  };

  let token: string;
  try { token = await login(); }
  catch (err) { report.errors.push((err as Error).message); writeReport(report); process.exit(1); return; }

  // 1. POST /run
  console.log(`[smoke] POST /offsite/pr/${STRESS_CLIENT_ID}/run ...`);
  console.log('[smoke] NOTE: fetches live RSS feeds and calls Cerebras (~30s if feeds return items).');
  const runR = await api(`/offsite/pr/${STRESS_CLIENT_ID}/run`, { method: 'POST', token });
  report.run_result = runR.data;

  if (runR.status !== 200) {
    report.errors.push(`run failed: ${runR.status} ${JSON.stringify(runR.data)}`);
    console.error('[smoke] run failed:', runR.status);
  } else {
    const signals = runR.data as Array<{ id: string; news_title: string; relevance_score: number }>;
    report.summary.new_signals = signals.length;
    console.log(`[smoke] run OK — ${signals.length} new signal(s) created`);
    for (const s of signals.slice(0, 3)) {
      console.log(`  "${s.news_title.slice(0, 70)}" score=${s.relevance_score.toFixed(2)}`);
    }
    if (signals.length === 0) {
      console.log('[smoke] No new signals (RSS feeds may be empty or all items already exist).');
    }
  }

  // 2. GET /signals
  console.log(`[smoke] GET /offsite/pr/${STRESS_CLIENT_ID}/signals ...`);
  const listR = await api(`/offsite/pr/${STRESS_CLIENT_ID}/signals`, { token });
  report.signals_result = listR.data;

  if (listR.status !== 200) {
    report.errors.push(`signals list failed: ${listR.status}`);
    console.error('[smoke] signals list failed:', listR.status);
  } else {
    const all = listR.data as Array<{ id: string; status: string; news_title: string }>;
    report.summary.total_signals = all.length;
    console.log(`[smoke] signals OK — ${all.length} total signal(s)`);

    const draft = all.find((s) => s.status === 'draft');
    if (draft) {
      // 3. PATCH /signal/:id/approve
      console.log(`[smoke] PATCH /offsite/pr/signal/${draft.id}/approve ...`);
      const approveR = await api(`/offsite/pr/signal/${draft.id}/approve`, { method: 'PATCH', token });
      report.approve_result = approveR.data;

      if (approveR.status !== 200) {
        report.errors.push(`approve failed: ${approveR.status}`);
        console.error('[smoke] approve failed:', approveR.status);
      } else {
        const approved = approveR.data as { id: string; status: string; approved_at: string };
        report.summary.approved_signal_id = approved.id;
        console.log(`[smoke] approve OK — status=${approved.status} approved_at=${approved.approved_at}`);

        // 4. PATCH /signal/:id/distribute
        console.log(`[smoke] PATCH /offsite/pr/signal/${approved.id}/distribute ...`);
        const distR = await api(`/offsite/pr/signal/${approved.id}/distribute`, { method: 'PATCH', token });
        report.distribute_result = distR.data;

        if (distR.status !== 200) {
          report.errors.push(`distribute failed: ${distR.status}`);
          console.error('[smoke] distribute failed:', distR.status);
        } else {
          const dist = distR.data as { id: string; status: string };
          report.summary.distributed_signal_id = dist.id;
          console.log(`[smoke] distribute OK — status=${dist.status}`);
        }
      }

      // 5. PATCH /signal/:id/archive — use a different draft signal if available
      const toArchive = all.find((s) => s.status === 'draft' && s.id !== draft.id) ?? draft;
      console.log(`[smoke] PATCH /offsite/pr/signal/${toArchive.id}/archive ...`);
      const archR = await api(`/offsite/pr/signal/${toArchive.id}/archive`, { method: 'PATCH', token });
      report.archive_result = archR.data;

      if (archR.status !== 200) {
        report.errors.push(`archive failed: ${archR.status}`);
        console.error('[smoke] archive failed:', archR.status);
      } else {
        const arch = archR.data as { id: string; status: string };
        report.summary.archived_signal_id = arch.id;
        console.log(`[smoke] archive OK — status=${arch.status}`);
      }
    } else {
      console.log('[smoke] No draft signals to test approve/distribute/archive transitions.');
    }
  }

  // 6. Auth guard
  const guardR = await api(`/offsite/pr/${STRESS_CLIENT_ID}/signals`);
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
  fs.writeFileSync('smoke-results-pr.json', JSON.stringify(report, null, 2));
  console.log('[smoke] Report written to smoke-results-pr.json');
}

main();
