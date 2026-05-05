/**
 * Smoke test: knowledge graph entity manager -- triggers runForClient,
 * checks latest result, checks history, verifies auth guard.
 * Writes smoke-results-knowledge-graph.json.
 *
 * Requires: app running on localhost:3000, .env populated.
 * Run: npx ts-node scripts/smoke-test-knowledge-graph.ts
 *
 * NOTE: runForClient makes live calls to Wikidata SPARQL, Google (Playwright),
 * and Wikipedia API. Allow ~20s for the full check to complete.
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
    latest_result: unknown;
    history_result: unknown;
    errors: string[];
    summary: {
      wikidata_found: boolean | null;
      wikidata_qid: string | null;
      gkp_detected: boolean | null;
      wikipedia_notable: boolean | null;
      wikipedia_flag: string | null;
      status_changed: boolean | null;
      history_count: number;
    };
  } = {
    timestamp: new Date().toISOString(),
    run_result: null,
    latest_result: null,
    history_result: null,
    errors: [],
    summary: {
      wikidata_found: null,
      wikidata_qid: null,
      gkp_detected: null,
      wikipedia_notable: null,
      wikipedia_flag: null,
      status_changed: null,
      history_count: 0,
    },
  };

  let token: string;
  try { token = await login(); }
  catch (err) { report.errors.push((err as Error).message); writeReport(report); process.exit(1); return; }

  // 1. POST /run
  console.log(`[smoke] POST /offsite/knowledge-graph/${STRESS_CLIENT_ID}/run ...`);
  console.log('[smoke] NOTE: makes live Wikidata SPARQL, Playwright GKP, and Wikipedia API calls (~20s).');
  const runR = await api(`/offsite/knowledge-graph/${STRESS_CLIENT_ID}/run`, { method: 'POST', token });
  report.run_result = runR.data;

  if (runR.status !== 200) {
    report.errors.push(`run failed: ${runR.status} ${JSON.stringify(runR.data)}`);
    console.error('[smoke] run failed:', runR.status, runR.data);
  } else {
    const check = runR.data as {
      id: string;
      wikidata_found: boolean; wikidata_qid: string | null;
      gkp_detected: boolean;
      wikipedia_notable: boolean; wikipedia_flag: string | null;
      status_changed: boolean;
    };
    report.summary.wikidata_found = check.wikidata_found;
    report.summary.wikidata_qid = check.wikidata_qid;
    report.summary.gkp_detected = check.gkp_detected;
    report.summary.wikipedia_notable = check.wikipedia_notable;
    report.summary.wikipedia_flag = check.wikipedia_flag;
    report.summary.status_changed = check.status_changed;

    console.log(`[smoke] run OK — entity check id=${check.id}`);
    console.log(`  Wikidata found: ${check.wikidata_found}  QID: ${check.wikidata_qid ?? 'n/a'}`);
    console.log(`  GKP detected:   ${check.gkp_detected}`);
    console.log(`  Wikipedia:      ${check.wikipedia_notable} (${check.wikipedia_flag ?? 'n/a'})`);
    console.log(`  Status changed: ${check.status_changed}`);
  }

  // 2. GET /latest
  console.log(`[smoke] GET /offsite/knowledge-graph/${STRESS_CLIENT_ID}/latest ...`);
  const latestR = await api(`/offsite/knowledge-graph/${STRESS_CLIENT_ID}/latest`, { token });
  report.latest_result = latestR.data;

  if (latestR.status !== 200) {
    report.errors.push(`latest failed: ${latestR.status}`);
    console.error('[smoke] latest failed:', latestR.status);
  } else {
    const latest = latestR.data as { id: string; checked_at: string } | null;
    if (latest) {
      console.log(`[smoke] latest OK — id=${latest.id} checked_at=${latest.checked_at}`);
    } else {
      console.log('[smoke] latest OK — null (no checks yet)');
    }
  }

  // 3. GET /history
  console.log(`[smoke] GET /offsite/knowledge-graph/${STRESS_CLIENT_ID}/history ...`);
  const historyR = await api(`/offsite/knowledge-graph/${STRESS_CLIENT_ID}/history`, { token });
  report.history_result = historyR.data;

  if (historyR.status !== 200) {
    report.errors.push(`history failed: ${historyR.status}`);
    console.error('[smoke] history failed:', historyR.status);
  } else {
    const history = historyR.data as Array<{ id: string }>;
    report.summary.history_count = history.length;
    console.log(`[smoke] history OK — ${history.length} check(s)`);
  }

  // 4. Auth guard
  const guardR = await api(`/offsite/knowledge-graph/${STRESS_CLIENT_ID}/latest`);
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
  fs.writeFileSync('smoke-results-knowledge-graph.json', JSON.stringify(report, null, 2));
  console.log('[smoke] Report written to smoke-results-knowledge-graph.json');
}

main();
