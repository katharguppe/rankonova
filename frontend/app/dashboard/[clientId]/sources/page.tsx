import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { CitationSource } from '@/lib/types';
import SourcesClient from './SourcesClient';

export default async function SourcesPage({ params }: { params: { clientId: string } }) {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) redirect('/login');

  let initial: CitationSource[] | null = null;
  try {
    initial = await apiFetch<CitationSource[]>(`/analytics/${params.clientId}/sources`, token);
  } catch {
    // render with null; client will retry via SWR
  }

  return <SourcesClient clientId={params.clientId} initial={initial} />;
}
