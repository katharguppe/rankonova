import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { GeoBreakdown } from '@/lib/types';
import GeoClient from './GeoClient';

export default async function GeoPage({ params }: { params: { clientId: string } }) {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) redirect('/login');

  let initial: GeoBreakdown[] | null = null;
  try {
    initial = await apiFetch<GeoBreakdown[]>(`/analytics/${params.clientId}/geo`, token);
  } catch {
    // render with null; client will retry via SWR
  }

  return <GeoClient clientId={params.clientId} initial={initial} />;
}
