import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { AggregatorSnapshot } from '@/lib/types';
import OffsiteClient from './OffsiteClient';

export default async function OffsitePage({ params }: { params: { clientId: string } }) {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) redirect('/login');

  let initialAggregator: AggregatorSnapshot[] = [];
  try {
    initialAggregator = await apiFetch<AggregatorSnapshot[]>(
      `/offsite/aggregator/${params.clientId}/latest`,
      token,
    );
  } catch {
    // client retries via SWR
  }

  return <OffsiteClient clientId={params.clientId} initialAggregator={initialAggregator} />;
}
