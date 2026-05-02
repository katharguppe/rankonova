'use client';

import useSWR from 'swr';
import { proxyFetch } from '@/lib/api';
import { fmt } from '@/lib/utils';
import type { GeoBreakdown } from '@/lib/types';
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
  initial: GeoBreakdown[] | null;
}

const GEO_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

export default function GeoClient({ clientId, initial }: Props) {
  const { data, isLoading } = useSWR<GeoBreakdown[]>(
    ['geo', clientId],
    () => proxyFetch<GeoBreakdown[]>(clientId, 'geo'),
    { fallbackData: initial ?? undefined, refreshInterval: 300_000 },
  );

  if (isLoading && !data) {
    return <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />;
  }

  if (!data || data.length === 0) {
    return <p className="text-slate-400 text-sm">No geographic data yet.</p>;
  }

  const chartData = data.map(g => ({
    ...g,
    label: g.state ? `${g.city}, ${g.state}` : g.city,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Geographic Segmentation</h1>
        <p className="text-sm text-slate-500 mt-0.5">Citation rate by location (last 30 days)</p>
      </div>

      {data.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-medium text-slate-700 mb-4">Citation Rate by City</p>
          <ResponsiveContainer width="100%" height={Math.max(160, data.length * 52)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 48 }}>
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${fmt(v)}%`, 'Citation rate']} />
              <Bar dataKey="citation_rate" radius={[0, 4, 4, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={GEO_COLORS[i % GEO_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left">
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">City</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">State</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Citation Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((g, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">{g.city}</td>
                <td className="px-4 py-3 text-slate-600">{g.state ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${g.citation_rate}%`,
                          backgroundColor: GEO_COLORS[i % GEO_COLORS.length],
                        }}
                      />
                    </div>
                    <span className="text-slate-700 tabular-nums">{fmt(g.citation_rate)}%</span>
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
