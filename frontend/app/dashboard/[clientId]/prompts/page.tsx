import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { PromptAnalysis } from '@/lib/types';
import PromptsClient from './PromptsClient';

export default async function PromptsPage({ params }: { params: { clientId: string } }) {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) redirect('/login');

  let initial: PromptAnalysis[] | null = null;
  try {
    initial = await apiFetch<PromptAnalysis[]>(`/analytics/${params.clientId}/prompts`, token);
  } catch {
    // render with null; client will retry via SWR
  }

  return <PromptsClient clientId={params.clientId} initial={initial} />;
}
