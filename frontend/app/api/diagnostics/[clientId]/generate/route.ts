import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function POST(
  _request: Request,
  { params }: { params: { clientId: string } },
) {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let res: Response;
  try {
    res = await fetch(`${API_URL}/diagnostics/${params.clientId}/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      // diagnostics generate runs Playwright crawls — allow up to 90s
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    const msg = err instanceof Error && err.name === 'TimeoutError'
      ? 'Report generation timed out (>90s) — try again'
      : 'API unreachable';
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (!res.ok) return NextResponse.json({ error: 'API error' }, { status: res.status });
  return NextResponse.json(await res.json());
}
