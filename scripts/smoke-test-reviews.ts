/**
 * Smoke test: reviews module B -- triggers runForClient, request-kit, snapshot
 * listing, draft generation, and auth guard. Writes smoke-results-reviews.json.
 *
 * Requires: app running on localhost:3000, .env populated, Playwright installed.
 * Run: npx ts-node scripts/smoke-test-reviews.ts
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
  options: { method?: string; token?: string; body?: unknown } = {},
): Promise<ApiResult> {
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
  const r = await api('/auth/login', {
    method: 'POST',
    body: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });
  if (r.status !== 201 && r.status !== 200)
    throw new Error(`Login failed: ${r.status} ${JSON.stringify(r.data)}`);
  const token = (r.data as { accessToken: string }).accessToken;
  if (!token) throw new Error('No accessToken in login response');
  console.log('[smoke] Login OK');
  return token;
}

async function main() {
  const report: {
    timestamp: string;
    run_result: unknown;
    latest_result: unknown;
    snapshots_result: unknown;
    negatives_result: unknown;
    kit_result: unknown;
    draft_result: unknown;
    errors: string[];
    summary: { platforms: string[]; total_reviews: number; negatives: number };
  } = {
    timestamp: new Date().toISOString(),
    run_result: null, latest_result: null,
    snapshots_result: null, negatives_result: null,
    kit_result: null, draft_result: null,
    errors: [],
    summary: { platforms: [], total_reviews: 0, negatives: 0 },
  };

  let token: string;
  try { token = await login(); }
  catch (err) { report.errors.push((err as Error).message); writeReport(report); process.exit(1); return; }

  // 1. POST /run — full scrape (Playwright, takes 1-3 min)
  console.log(`[smoke] POST /offsite/reviews/${STRESS_CLIENT_ID}/run ...`);
  console.log('[smoke] NOTE: Playwright will crawl live review pages. Allow 2-3 min.');
  const runR = await api(`/offsite/reviews/${STRESS_CLIENT_ID}/run`, { method: 'POST', token });
  report.run_result = runR.data;
  if (runR.status !== 200 && runR.status !== 201) {
    report.errors.push(`run failed: ${runR.status}`);
    console.error('[smoke] run failed:', runR.status, JSON.stringify(runR.data));
  } else {
    const audits = runR.data as Array<{ platform: string; review_count: number | null; rating: number | null }>;
    report.summary.platforms = audits.map((a) => a.platform);
    report.summary.total_reviews = audits.reduce((s, a) => s + (a.review_count ?? 0), 0);
    console.log(`[smoke] run OK — ${audits.length} platform audit(s)`);
    for (const a of audits) {
      console.log(`  ${a.platform}: rating=${a.rating ?? 'n/a'}, reviews=${a.review_count ?? 0}`);
    }
  }

  // 2. GET /latest
  console.log(`[smoke] GET /offsite/reviews/${STRESS_CLIENT_ID}/latest ...`);
  const latestR = await api(`/offsite/reviews/${STRESS_CLIENT_ID}/latest`, { token });
  report.latest_result = latestR.data;
  if (latestR.status !== 200) {
    report.errors.push(`latest failed: ${latestR.status}`);
    console.error('[smoke] latest failed:', latestR.status);
  } else {
    const audits = latestR.data as Array<{ platform: string }>;
    console.log(`[smoke] latest OK — ${audits.length} audit(s)`);
  }

  // 3. GET /snapshots
  console.log(`[smoke] GET /offsite/reviews/${STRESS_CLIENT_ID}/snapshots ...`);
  const snapsR = await api(`/offsite/reviews/${STRESS_CLIENT_ID}/snapshots`, { token });
  report.snapshots_result = snapsR.data;
  if (snapsR.status !== 200) {
    report.errors.push(`snapshots failed: ${snapsR.status}`);
    console.error('[smoke] snapshots failed:', snapsR.status);
  } else {
    const snaps = snapsR.data as Array<{ id: string; is_negative: boolean; rating: number }>;
    console.log(`[smoke] snapshots OK — ${snaps.length} review snapshot(s)`);
  }

  // 4. GET /snapshots?is_negative=true
  console.log(`[smoke] GET /offsite/reviews/${STRESS_CLIENT_ID}/snapshots?is_negative=true ...`);
  const negR = await api(`/offsite/reviews/${STRESS_CLIENT_ID}/snapshots?is_negative=true`, { token });
  report.negatives_result = negR.data;
  if (negR.status !== 200) {
    report.errors.push(`negatives failed: ${negR.status}`);
    console.error('[smoke] negatives failed:', negR.status);
  } else {
    const negs = negR.data as Array<{ id: string; rating: number; response_draft: string | null }>;
    report.summary.negatives = negs.length;
    console.log(`[smoke] negatives OK — ${negs.length} negative(s)`);
    if (negs.length > 0) {
      console.log(`  First: rating=${negs[0].rating}, draft=${negs[0].response_draft ? 'present' : 'pending'}`);
    }

    // 5. Draft generation for first undrafted negative
    const undrafted = negs.find((n) => !n.response_draft);
    if (undrafted) {
      console.log(`[smoke] POST /offsite/reviews/snapshot/${undrafted.id}/draft ...`);
      const draftR = await api(`/offsite/reviews/snapshot/${undrafted.id}/draft`, { method: 'POST', token });
      report.draft_result = draftR.data;
      if (draftR.status !== 200) {
        report.errors.push(`draft failed: ${draftR.status}`);
        console.error('[smoke] draft failed:', draftR.status);
      } else {
        const snap = draftR.data as { response_draft: string };
        console.log(`[smoke] draft OK — ${snap.response_draft?.length ?? 0} chars`);
        console.log(`  Draft: "${snap.response_draft?.slice(0, 80)}..."`);
      }
    } else {
      console.log('[smoke] All negatives already have drafts — skipping draft generation');
    }
  }

  // 6. POST /request-kit
  console.log(`[smoke] POST /offsite/reviews/${STRESS_CLIENT_ID}/request-kit ...`);
  const kitGenR = await api(`/offsite/reviews/${STRESS_CLIENT_ID}/request-kit`, { method: 'POST', token });
  if (kitGenR.status !== 200) {
    report.errors.push(`request-kit POST failed: ${kitGenR.status}`);
    console.error('[smoke] request-kit POST failed:', kitGenR.status);
  } else {
    console.log('[smoke] request-kit generate OK');
  }

  // 7. GET /request-kit
  console.log(`[smoke] GET /offsite/reviews/${STRESS_CLIENT_ID}/request-kit ...`);
  const kitR = await api(`/offsite/reviews/${STRESS_CLIENT_ID}/request-kit`, { token });
  report.kit_result = kitR.data;
  if (kitR.status !== 200) {
    report.errors.push(`request-kit GET failed: ${kitR.status}`);
    console.error('[smoke] request-kit GET failed:', kitR.status);
  } else {
    const kit = kitR.data as { whatsapp_template: string; sms_template: string; qr_code_html: string };
    console.log('[smoke] request-kit GET OK');
    console.log(`  WhatsApp: "${kit.whatsapp_template?.slice(0, 60)}..."`);
    console.log(`  SMS: "${kit.sms_template?.slice(0, 60)}"`);
    console.log(`  QR HTML: ${kit.qr_code_html?.length ?? 0} chars`);
  }

  // 8. Auth guard
  const guardR = await api(`/offsite/reviews/${STRESS_CLIENT_ID}/latest`);
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
  fs.writeFileSync('smoke-results-reviews.json', JSON.stringify(report, null, 2));
  console.log('[smoke] Report written to smoke-results-reviews.json');
}

main();
