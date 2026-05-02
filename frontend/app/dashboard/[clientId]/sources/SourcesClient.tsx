'use client';

import useSWR from 'swr';
import { proxyFetch } from '@/lib/api';
import type { CitationSource } from '@/lib/types';
import { ExternalLink } from 'lucide-react';

interface Props {
  clientId: string;
  initial: CitationSource[] | null;
}

export default function SourcesClient({ clientId, initial }: Props) {
  const { data, isLoading } = useSWR<CitationSource[]>(
    ['sources', clientId],
    () => proxyFetch<CitationSource[]>(clientId, 'sources'),
    { fallbackData: initial ?? undefined, refreshInterval: 300_000 },
  );

  if (isLoading && !data) {
    return <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />;
  }

  if (!data || data.length === 0) {
    return <p className="text-slate-400 text-sm">No citation sources found yet.</p>;
  }

  const maxCount = Math.max(...data.map(s => s.mention_count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Citation Sources</h1>
        <p className="text-sm text-slate-500 mt-0.5">URLs cited in AI responses for your brand (last 30 days)</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left">
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Domain</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide w-1/3">URL</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Mentions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((s, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <span className="font-medium text-slate-800">{s.domain}</span>
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline truncate"
                    title={s.url}
                  >
                    <span className="truncate">{s.url}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(s.mention_count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-slate-700 tabular-nums">{s.mention_count}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
