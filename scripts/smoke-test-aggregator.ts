/**
 * Smoke test: aggregator profile monitor — triggers runForClient for the stress client,
 * prints snapshot results, writes report to smoke-results-aggregator.json.
 *
 * Requires: app running on localhost:3000, .env populated, Playwright installed.
 * Run: npx ts-node --require dotenv/register scripts/smoke-test-aggregator.ts
 */

import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ override: true });

const BASE = 'http://localhost:3000';
const DEMO_EMAIL = 'demo@aeo-suite.local';
const DEMO_PASSWORD = 'Demo@2026!';
const STRESS_CLIENT_ID = 'cmonwtk9r00002ku9q59ge1h4';

interface ApiResult {
  status: number;
  data: unknown;
}

async function api(path: string, options: { method?: string; token?: string; body?: unknown } = {}): Promise<ApiResult> {
  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data: unknown;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

async function login(): Promise<string> {
  const result = await api('/auth/login', {
    method: 'POST',
    body: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });
  if (result.status !== 201 && result.status !== 200) {
    throw new Error(`Login failed: ${result.status} ${JSON.stringify(result.data)}`);
  }
  const token = (result.data as { accessToken: string }).accessToken;
  if (!token) throw new Error('No accessToken in login response');
  console.log('[smoke] Login OK');
  return token;
}

async function main() {
  const report: {
    timestamp: string;
    run_result: unknown;
    latest_result: unknown;
    errors: string[];
    summary: { snapshots_created: number; platforms: string[]; avg_completeness: number };
  } = {
    timestamp: new Date().toISOString(),
    run_result: null,
    latest_result: null,
    errors: [],
    summary: { snapshots_created: 0, platforms: [], avg_completeness: 0 },
  };

  try {
    const token = await login();

    // Step 1: Trigger runForClient
    console.log(`[smoke] POST /offsite/aggregator/${STRESS_CLIENT_ID}/run ...`);
    console.log('[smoke] NOTE: This will launch Playwright and crawl real URLs. May take 2-5 min.');
    const runResult = await api(`/offsite/aggregator/${STRESS_CLIENT_ID}/run`, {
      method: 'POST',
      token,
    });
    report.run_result = runResult.data;

    if (runResult.status !== 200 && runResult.status !== 201) {
      report.errors.push(`run failed: ${runResult.status} ${JSON.stringify(runResult.data)}`);
      console.error(`[smoke] run failed: ${runResult.status}`);
    } else {
      const snapshots = runResult.data as Array<{
        id: string;
        platform: string;
        completeness_score: number;
        fields_present: string[];
        fields_missing: string[];
      }>;
      report.summary.snapshots_created = snapshots.length;
      report.summary.platforms = snapshots.map((s) => s.platform);
      report.summary.avg_completeness =
        snapshots.length > 0
          ? Math.round(snapshots.reduce((sum, s) => sum + s.completeness_score, 0) / snapshots.length * 10) / 10
          : 0;

      console.log(`[smoke] run OK — ${snapshots.length} snapshot(s) saved`);
      for (const snap of snapshots) {
        console.log(
          `  ${snap.platform}: score=${snap.completeness_score}%, present=[${snap.fields_present.join(', ')}], missing=[${snap.fields_missing.join(', ')}]`,
        );
      }
    }

    // Step 2: GET latest snapshots
    console.log(`[smoke] GET /offsite/aggregator/${STRESS_CLIENT_ID}/latest ...`);
    const latestResult = await api(`/offsite/aggregator/${STRESS_CLIENT_ID}/latest`, { token });
    report.latest_result = latestResult.data;

    if (latestResult.status !== 200) {
      report.errors.push(`latest failed: ${latestResult.status} ${JSON.stringify(latestResult.data)}`);
      console.error(`[smoke] latest failed: ${latestResult.status}`);
    } else {
      const latest = latestResult.data as Array<{ platform: string; completeness_score: number; crawled_at: string }>;
      console.log(`[smoke] latest OK — ${latest.length} snapshot(s) returned`);
      for (const snap of latest) {
        console.log(`  ${snap.platform}: score=${snap.completeness_score}%, crawled_at=${snap.crawled_at}`);
      }
    }

    // Step 3: Guard test — unauthenticated request must return 401
    const guardResult = await api(`/offsite/aggregator/${STRESS_CLIENT_ID}/latest`);
    if (guardResult.status === 401) {
      console.log('[smoke] Auth guard OK — 401 on unauthenticated request');
    } else {
      report.errors.push(`Auth guard FAILED: expected 401, got ${guardResult.status}`);
      console.error(`[smoke] Auth guard FAILED: got ${guardResult.status}`);
    }

  } catch (err) {
    report.errors.push((err as Error).message);
    console.error('[smoke] Fatal error:', (err as Error).message);
  }

  const outPath = 'smoke-results-aggregator.json';
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\n[smoke] Report written to ${outPath}`);

  const pass = report.errors.length === 0;
  console.log(pass ? '[smoke] PASS' : `[smoke] FAIL — ${report.errors.length} error(s)`);
  if (!pass) {
    for (const e of report.errors) console.error(' ', e);
    process.exit(1);
  }
}

main();
