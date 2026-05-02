const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function apiFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// Client-side fetcher for SWR (goes through Next.js proxy route)
export async function proxyFetch<T>(clientId: string, endpoint: string): Promise<T> {
  const res = await fetch(`/api/analytics/${clientId}/${endpoint}`);
  if (!res.ok) throw new Error(`${res.status}: ${endpoint}`);
  return res.json() as Promise<T>;
}
