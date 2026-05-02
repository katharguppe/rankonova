import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { CitationOverview } from '@/lib/types';
import CitationOverviewClient from './CitationOverviewClient';

export default async function OverviewPage({ params }: { params: { clientId: string } }) {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) redirect('/login');

  let initial: CitationOverview | null = null;
  try {
    initial = await apiFetch<CitationOverview>(
      `/analytics/${params.clientId}/citation-overview`,
      token,
    );
  } catch {
    // render with null; client will retry via SWR
  }

  return <CitationOverviewClient clientId={params.clientId} initial={initial} />;
}
