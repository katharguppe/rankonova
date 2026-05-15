import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { DashboardHeader } from '@/components/DashboardHeader';

interface Client { id: string; brand_name: string }

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { clientId: string };
}) {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) redirect('/login');

  let brandName: string | undefined;
  try {
    const client = await apiFetch<Client>(`/clients/${params.clientId}`, token);
    brandName = client.brand_name;
  } catch {
    // clients endpoint may not be implemented; sidebar falls back to clientId
  }

  return (
    <>
      <DashboardHeader clientId={params.clientId} />
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar clientId={params.clientId} brandName={brandName} />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </>
  );
}
