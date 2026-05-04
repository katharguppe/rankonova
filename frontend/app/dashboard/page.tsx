import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface Client { id: string; brand_name: string }

export default async function DashboardIndex() {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) redirect('/login');

  // Capture first client ID inside try so the fetch error is handled,
  // then call redirect() OUTSIDE the try block.
  // Next.js redirect() throws a special internal error — if called inside
  // a try/catch the catch swallows it and the redirect never fires.
  let firstClientId: string | null = null;
  try {
    const clients = await apiFetch<Client[]>('/tenants/me/clients', token);
    console.log('[dashboard] /tenants/me/clients →', clients.length, 'client(s)', clients.map(c => c.id));
    if (clients.length > 0) firstClientId = clients[0].id;
  } catch (err) {
    console.error('[dashboard] /tenants/me/clients fetch failed:', err);
  }

  if (firstClientId) redirect(`/dashboard/${firstClientId}/overview`);

  return (
    <div className="flex items-center justify-center h-screen text-slate-500">
      No clients found. Add a client to get started.
    </div>
  );
}
