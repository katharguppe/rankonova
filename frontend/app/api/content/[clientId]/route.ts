import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function GET(
  request: Request,
  { params }: { params: { clientId: string } },
) {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';

  let res: Response;
  try {
    res = await fetch(`${API_URL}/content/${params.clientId}${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'API unreachable' }, { status: 502 });
  }

  if (!res.ok) return NextResponse.json({ error: 'API error' }, { status: res.status });
  return NextResponse.json(await res.json());
}
