import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

const VALID_MODULES = new Set(['aggregator', 'reviews', 'community', 'knowledge-graph', 'pr']);

export async function POST(
  _request: Request,
  { params }: { params: { clientId: string; module: string } },
) {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!VALID_MODULES.has(params.module)) {
    return NextResponse.json({ error: 'Unknown module' }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(
      `${API_URL}/offsite/${params.module}/${params.clientId}/run`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(60_000),
      },
    );
  } catch (err) {
    const msg = err instanceof Error && err.name === 'TimeoutError'
      ? 'Run timed out — try again'
      : 'API unreachable';
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (!res.ok) return NextResponse.json({ error: 'API error' }, { status: res.status });
  return NextResponse.json(await res.json());
}
