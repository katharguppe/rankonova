'use client';

import useSWR from 'swr';
import { proxyFetch } from '@/lib/api';
import { fmt } from '@/lib/utils';
import type { EngineBreakdown } from '@/lib/types';
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
  initial: EngineBreakdown[] | null;
}

const ENGINE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

export default function EnginesClient({ clientId, initial }: Props) {
  const { data, isLoading } = useSWR<EngineBreakdown[]>(
    ['engines', clientId],
    () => proxyFetch<EngineBreakdown[]>(clientId, 'engines'),
    { fallbackData: initial ?? undefined, refreshInterval: 300_000 },
  );

  if (isLoading && !data) {
    return <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />;
  }

  if (!data || data.length === 0) {
    return <p className="text-slate-400 text-sm">No engine data yet.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Engine Breakdown</h1>
        <p className="text-sm text-slate-500 mt-0.5">Citation rate per AI engine (last 30 days)</p>
      </div>

      {/* Bar chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-sm font-medium text-slate-700 mb-4">Citation Rate by Engine</p>
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 52)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 48 }}>
            <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="engine" width={88} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`${fmt(v)}%`, 'Citation rate']} />
            <Bar dataKey="citation_rate" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={ENGINE_COLORS[i % ENGINE_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stats table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left">
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Engine</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Citation Rate</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Cited Runs</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Total Runs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((e, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: ENGINE_COLORS[i % ENGINE_COLORS.length] }}
                    />
                    <span className="font-medium text-slate-800 capitalize">{e.engine}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${e.citation_rate}%`,
                          backgroundColor: ENGINE_COLORS[i % ENGINE_COLORS.length],
                        }}
                      />
                    </div>
                    <span className="text-slate-700 tabular-nums">{fmt(e.citation_rate)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700 tabular-nums">{e.cited_runs}</td>
                <td className="px-4 py-3 text-slate-500 tabular-nums">{e.run_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
