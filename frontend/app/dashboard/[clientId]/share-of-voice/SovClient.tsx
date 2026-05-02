'use client';

import useSWR from 'swr';
import { proxyFetch } from '@/lib/api';
import { fmt } from '@/lib/utils';
import type { SovEntry } from '@/lib/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface Props {
  clientId: string;
  initial: SovEntry[] | null;
}

export default function SovClient({ clientId, initial }: Props) {
  const { data, isLoading } = useSWR<SovEntry[]>(
    ['share-of-voice', clientId],
    () => proxyFetch<SovEntry[]>(clientId, 'share-of-voice'),
    { fallbackData: initial ?? undefined, refreshInterval: 300_000 },
  );

  if (isLoading && !data) {
    return <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />;
  }

  if (!data || data.length === 0) {
    return <p className="text-slate-400 text-sm">No share of voice data yet.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Share of Voice</h1>
        <p className="text-sm text-slate-500 mt-0.5">Citation rate vs competitors (last 30 days)</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 48)}>
          <BarChart data={data} layout="vertical" margin={{ left: 16, right: 48 }}>
            <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="brand_name" width={120} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`${fmt(v)}%`, 'Citation rate']} />
            <Bar dataKey="citation_rate" radius={[0, 4, 4, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.is_client ? '#3b82f6' : '#cbd5e1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left">
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Brand</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Citation Rate</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((entry, i) => (
              <tr key={i} className={entry.is_client ? 'bg-blue-50/40' : ''}>
                <td className="px-4 py-3 font-medium text-slate-800">{entry.brand_name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${entry.citation_rate}%`,
                          backgroundColor: entry.is_client ? '#3b82f6' : '#94a3b8',
                        }}
                      />
                    </div>
                    <span className="text-slate-700">{fmt(entry.citation_rate)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    entry.is_client
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {entry.is_client ? 'You' : 'Competitor'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
