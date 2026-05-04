import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { ContentListItem } from '@/lib/types';
import ContentClient from './ContentClient';

export default async function ContentPage({ params }: { params: { clientId: string } }) {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) redirect('/login');

  let initial: ContentListItem[] = [];
  try {
    initial = await apiFetch<ContentListItem[]>(`/content/${params.clientId}`, token);
  } catch {
    // client will retry via SWR
  }

  return <ContentClient clientId={params.clientId} initial={initial} />;
}
