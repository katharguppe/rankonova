import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface Client { id: string; brand_name: string }

export default async function DashboardIndex() {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) redirect('/login');

  try {
    const clients = await apiFetch<Client[]>('/tenants/me/clients', token);
    if (clients.length > 0) {
      redirect(`/dashboard/${clients[0].id}/overview`);
    }
  } catch {
    // fallback: clients endpoint may not be implemented yet
  }

  return (
    <div className="flex items-center justify-center h-screen text-slate-500">
      No clients found. Add a client to get started.
    </div>
  );
}
