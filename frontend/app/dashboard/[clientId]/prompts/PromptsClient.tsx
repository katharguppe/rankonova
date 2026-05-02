'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { proxyFetch } from '@/lib/api';
import { fmt } from '@/lib/utils';
import type { PromptAnalysis } from '@/lib/types';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface Props {
  clientId: string;
  initial: PromptAnalysis[] | null;
}

type SortKey = 'citation_rate' | 'run_count';

const INTENT_BADGE: Record<string, string> = {
  informational: 'bg-blue-100 text-blue-700',
  navigational: 'bg-purple-100 text-purple-700',
  transactional: 'bg-emerald-100 text-emerald-700',
  commercial: 'bg-amber-100 text-amber-700',
};

export default function PromptsClient({ clientId, initial }: Props) {
  const { data, isLoading } = useSWR<PromptAnalysis[]>(
    ['prompts', clientId],
    () => proxyFetch<PromptAnalysis[]>(clientId, 'prompts'),
    { fallbackData: initial ?? undefined, refreshInterval: 300_000 },
  );

  const [sortKey, setSortKey] = useState<SortKey>('citation_rate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  if (isLoading && !data) {
    return <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />;
  }

  if (!data || data.length === 0) {
    return <p className="text-slate-400 text-sm">No prompt data yet.</p>;
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = [...data].sort((a, b) => {
    const mul = sortDir === 'desc' ? -1 : 1;
    return (a[sortKey] - b[sortKey]) * mul;
  });

  const maxRate = Math.max(...data.map(p => p.citation_rate), 0.01);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'desc'
      ? <ChevronDown className="w-3 h-3 text-slate-600" />
      : <ChevronUp className="w-3 h-3 text-slate-600" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Prompt-Level Analysis</h1>
        <p className="text-sm text-slate-500 mt-0.5">Citation rate per prompt (last 30 days)</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left">
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide w-1/2">
                Prompt
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Intent
              </th>
              <th
                className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide cursor-pointer select-none"
                onClick={() => toggleSort('citation_rate')}
              >
                <span className="flex items-center gap-1">Citation Rate <SortIcon col="citation_rate" /></span>
              </th>
              <th
                className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide cursor-pointer select-none"
                onClick={() => toggleSort('run_count')}
              >
                <span className="flex items-center gap-1">Runs <SortIcon col="run_count" /></span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((p, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-800 max-w-xs">
                  <p className="truncate" title={p.text}>{p.text}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${INTENT_BADGE[p.intent_type] ?? 'bg-slate-100 text-slate-600'}`}
                  >
                    {p.intent_type.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(p.citation_rate / maxRate) * 100}%` }}
                      />
                    </div>
                    <span className="text-slate-700 tabular-nums">{fmt(p.citation_rate)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 tabular-nums">{p.run_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
