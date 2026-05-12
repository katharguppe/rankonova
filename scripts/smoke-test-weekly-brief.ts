/**
 * Smoke test: weekly-brief — generates brief for stress client + all clients,
 * logs results with timing, writes report to smoke-results-weekly-brief.json.
 *
 * Requires: app running on localhost:3000, .env populated.
 * Run: npx ts-node scripts/smoke-test-weekly-brief.ts
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

interface TestResult {
  timestamp: string;
  testClientBrief: {
    status: number;
    clientId: string;
    weekOf: string;
    duration_ms: number;
    briefId?: string;
    error?: string;
  };
  allClientsBriefs: {
    status: number;
    duration_ms: number;
    briefsGenerated?: number;
    briefIds?: string[];
    error?: string;
  };
  errors: string[];
}

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
  try {
    data = await res.json();
  } catch {
    data = null;
  }
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

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

async function main() {
  const report: TestResult = {
    timestamp: new Date().toISOString(),
    testClientBrief: {
      status: 0,
      clientId: STRESS_CLIENT_ID,
      weekOf: getMonday(new Date()).toISOString(),
      duration_ms: 0,
    },
    allClientsBriefs: {
      status: 0,
      duration_ms: 0,
    },
    errors: [],
  };

  try {
    const token = await login();
    const weekOf = getMonday(new Date());

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(' SMOKE TEST — weekly-brief');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Timestamp: ${report.timestamp}`);
    console.log(`  Week of:   ${weekOf.toISOString()}`);
    console.log('');

    // Test 1: Single client brief generation
    console.log('[1] Testing single client brief generation...');
    console.log(`    Client: ${STRESS_CLIENT_ID}`);
    const singleStart = Date.now();
    const singleRes = await api(`/weekly-brief/${STRESS_CLIENT_ID}/generate`, {
      method: 'POST',
      token,
      body: { weekOf: weekOf.toISOString() },
    });
    const singleDuration = Date.now() - singleStart;
    report.testClientBrief.status = singleRes.status;
    report.testClientBrief.duration_ms = singleDuration;

    if (singleRes.status === 200 || singleRes.status === 201) {
      const briefData = singleRes.data as any;
      const briefId = briefData?.id ?? briefData?.brief_id ?? null;
      if (briefId) {
        report.testClientBrief.briefId = briefId;
      }
      console.log(`    ✓ Single client brief generated (${singleDuration}ms)`);
      if (briefId) console.log(`    Brief ID: ${briefId.slice(0, 12)}...`);
    } else {
      const errorMsg = `HTTP ${singleRes.status}: ${JSON.stringify(singleRes.data).slice(0, 200)}`;
      report.testClientBrief.error = errorMsg;
      report.errors.push(`Single client brief failed: ${errorMsg}`);
      console.log(`    ✗ Failed (${singleRes.status})`);
      console.log(`    Error: ${errorMsg}`);
    }

    // Test 2: All clients brief generation
    console.log('\n[2] Testing all clients brief generation...');
    const allStart = Date.now();
    const allRes = await api('/weekly-brief/generate-all', {
      method: 'POST',
      token,
      body: { weekOf: weekOf.toISOString() },
    });
    const allDuration = Date.now() - allStart;
    report.allClientsBriefs.status = allRes.status;
    report.allClientsBriefs.duration_ms = allDuration;

    if (allRes.status === 200 || allRes.status === 201) {
      const allData = allRes.data as any;
      let generatedCount = 0;
      const briefIds: string[] = [];

      if (Array.isArray(allData)) {
        generatedCount = allData.length;
        for (const brief of allData) {
          const id = brief?.id ?? brief?.brief_id ?? null;
          if (id) briefIds.push(id);
        }
      } else if (typeof allData === 'object' && allData !== null) {
        generatedCount = (allData as any).briefs_generated ?? 0;
        const ids = (allData as any).brief_ids ?? [];
        if (Array.isArray(ids)) briefIds.push(...ids);
      }

      report.allClientsBriefs.briefsGenerated = generatedCount;
      if (briefIds.length > 0) {
        report.allClientsBriefs.briefIds = briefIds.slice(0, 5); // Store up to 5 IDs
      }

      console.log(`    ✓ All clients briefs generated (${allDuration}ms)`);
      console.log(`    Generated: ${generatedCount} brief(s)`);
      if (briefIds.length > 0) {
        console.log(`    IDs: ${briefIds.slice(0, 3).map((id) => id.slice(0, 12) + '...').join(', ')}`);
      }
    } else {
      const errorMsg = `HTTP ${allRes.status}: ${JSON.stringify(allRes.data).slice(0, 200)}`;
      report.allClientsBriefs.error = errorMsg;
      report.errors.push(`All clients brief failed: ${errorMsg}`);
      console.log(`    ✗ Failed (${allRes.status})`);
      console.log(`    Error: ${errorMsg}`);
    }

    // Final report
    const singlePassed = report.testClientBrief.status === 200 || report.testClientBrief.status === 201;
    const allPassed = report.allClientsBriefs.status === 200 || report.allClientsBriefs.status === 201;
    const overallPassed = singlePassed && allPassed;

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(' SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Single Client Brief:   ${singlePassed ? '[PASS]' : '[FAIL]'} (${report.testClientBrief.duration_ms}ms)`);
    console.log(`  All Clients Briefs:    ${allPassed ? '[PASS]' : '[FAIL]'} (${report.allClientsBriefs.duration_ms}ms)`);
    console.log(`  Total Errors:          ${report.errors.length}`);
    console.log('');
    console.log(`  Overall:               ${overallPassed ? '[PASS]' : '[PARTIAL/FAIL]'}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Write JSON report
    const reportPath = 'smoke-results-weekly-brief.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`  Report written to ${reportPath}\n`);

    if (!overallPassed) {
      process.exit(1);
    }
  } catch (err) {
    const errorMsg = (err as Error).message ?? String(err);
    report.errors.push(errorMsg);
    console.error('\n[SMOKE TEST FAILED]', errorMsg);
    console.error((err as Error).stack);

    // Write failure report
    const reportPath = 'smoke-results-weekly-brief.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nFailure report written to ${reportPath}`);

    process.exit(1);
  }
}

main();
