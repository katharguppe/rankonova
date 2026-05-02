import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { SovEntry } from '@/lib/types';
import SovClient from './SovClient';

export default async function ShareOfVoicePage({ params }: { params: { clientId: string } }) {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) redirect('/login');

  let initial: SovEntry[] | null = null;
  try {
    initial = await apiFetch<SovEntry[]>(
      `/analytics/${params.clientId}/share-of-voice`,
      token,
    );
  } catch {
    // client retries via SWR
  }

  return <SovClient clientId={params.clientId} initial={initial} />;
}
