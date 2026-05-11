import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ error: 'Cannot reach API' }, { status: 502 });
  }

  if (!res.ok) {
    if (res.status >= 500) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 502 });
    }
    let errorBody: unknown;
    try {
      errorBody = await res.json();
    } catch {
      const text = await res.text();
      errorBody = { error: text || 'Registration failed' };
    }
    return NextResponse.json(errorBody, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
