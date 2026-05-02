import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { SentimentAnalysis } from '@/lib/types';
import SentimentClient from './SentimentClient';

export default async function SentimentPage({ params }: { params: { clientId: string } }) {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) redirect('/login');

  let initial: SentimentAnalysis | null = null;
  try {
    initial = await apiFetch<SentimentAnalysis>(`/analytics/${params.clientId}/sentiment`, token);
  } catch {
    // render with null; client will retry via SWR
  }

  return <SentimentClient clientId={params.clientId} initial={initial} />;
}
