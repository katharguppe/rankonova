import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

interface Client { id: string; brand_name: string; city?: string; state?: string }

export default async function DashboardIndex() {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) redirect('/login');

  let clients: Client[] = [];
  try {
    clients = await apiFetch<Client[]>('/tenants/me/clients', token);
  } catch (err) {
    console.error('[dashboard] /tenants/me/clients fetch failed:', err);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
            <p className="text-sm text-slate-500 mt-0.5">Select a client to view its dashboard</p>
          </div>
          <Link
            href="/dashboard/new-client"
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <span>+</span>
            <span>Add Client</span>
          </Link>
        </div>

        {clients.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-lg font-medium">No clients yet</p>
            <p className="text-sm mt-1">Click &ldquo;Add Client&rdquo; to onboard your first client.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map(client => (
              <Link
                key={client.id}
                href={`/dashboard/${client.id}/overview`}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <p className="text-base font-semibold text-slate-900 truncate">{client.brand_name}</p>
                {(client.city || client.state) && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    {[client.city, client.state].filter(Boolean).join(', ')}
                  </p>
                )}
                <p className="text-xs text-blue-600 mt-3 font-medium">Open dashboard &#8594;</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
