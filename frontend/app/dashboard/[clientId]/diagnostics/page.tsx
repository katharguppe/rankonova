import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { GapReport } from '@/lib/types';
import DiagnosticsClient from './DiagnosticsClient';

export default async function DiagnosticsPage({ params }: { params: { clientId: string } }) {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) redirect('/login');

  let initial: GapReport | null = null;
  try {
    initial = await apiFetch<GapReport>(
      `/diagnostics/${params.clientId}/reports/latest`,
      token,
    );
  } catch {
    // 404 (no reports yet) or network error — client renders empty state
  }

  return <DiagnosticsClient clientId={params.clientId} initial={initial} />;
}
