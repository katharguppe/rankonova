import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

// Maps frontend module slug to backend path suffix after /offsite/{module}/{clientId}/
const MODULE_GET_PATH: Record<string, string> = {
  aggregator:        'latest',
  reviews:           'latest',
  community:         'threads',
  'knowledge-graph': 'latest',
  pr:                'signals',
};

export async function GET(
  request: Request,
  { params }: { params: { clientId: string; module: string } },
) {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const suffix = MODULE_GET_PATH[params.module];
  if (!suffix) return NextResponse.json({ error: 'Unknown module' }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';

  let res: Response;
  try {
    res = await fetch(
      `${API_URL}/offsite/${params.module}/${params.clientId}/${suffix}${qs}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    );
  } catch {
    return NextResponse.json({ error: 'API unreachable' }, { status: 502 });
  }

  if (res.status === 404) return NextResponse.json(null, { status: 200 });
  if (!res.ok) return NextResponse.json({ error: 'API error' }, { status: res.status });
  return NextResponse.json(await res.json());
}
