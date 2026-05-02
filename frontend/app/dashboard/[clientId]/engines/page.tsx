import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { EngineBreakdown } from '@/lib/types';
import EnginesClient from './EnginesClient';

export default async function EnginesPage({ params }: { params: { clientId: string } }) {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) redirect('/login');

  let initial: EngineBreakdown[] | null = null;
  try {
    initial = await apiFetch<EngineBreakdown[]>(`/analytics/${params.clientId}/engines`, token);
  } catch {
    // render with null; client will retry via SWR
  }

  return <EnginesClient clientId={params.clientId} initial={initial} />;
}
