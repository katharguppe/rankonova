import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function POST(
  _request: Request,
  { params }: { params: { clientId: string } },
) {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const res = await fetch(`${API_URL}/prompt-engine/clients/${params.clientId}/run-all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return NextResponse.json({ error: 'API error' }, { status: res.status });
  return NextResponse.json(await res.json());
}
