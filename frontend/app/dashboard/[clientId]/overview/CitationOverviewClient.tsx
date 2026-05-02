'use client';

import useSWR from 'swr';
import { proxyFetch } from '@/lib/api';
import { fmt } from '@/lib/utils';
import type { CitationOverview } from '@/lib/types';
import {
  RadialBarChart,
  RadialBar,
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
  initial: CitationOverview | null;
}

const ENGINE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

export default function CitationOverviewClient({ clientId, initial }: Props) {
  const { data, isLoading } = useSWR<CitationOverview>(
    ['citation-overview', clientId],
    () => proxyFetch<CitationOverview>(clientId, 'citation-overview'),
    { fallbackData: initial ?? undefined, refreshInterval: 300_000 },
  );

  if (isLoading && !data) {
    return <OverviewSkeleton />;
  }

  if (!data) {
    return <p className="text-slate-400 text-sm">No data available yet. Run some prompts first.</p>;
  }

  const delta7v30 = data.windows['7d'] - data.windows['30d'];

  const gaugeData = [{ value: data.windows['7d'], fill: '#3b82f6' }];

  const engineData = Object.entries(data.byEngine).map(([engine, rate]) => ({
    engine,
    rate,
  }));

  const intentData = Object.entries(data.byIntent).map(([intent, rate]) => ({
    intent: intent.replace(/_/g, ' '),
    rate,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Citation Overview</h1>
        <p className="text-sm text-slate-500 mt-0.5">How often your brand appears in AI responses</p>
      </div>

      {/* Top KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(['7d', '30d', '90d'] as const).map(w => (
          <div key={w} className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {w === '7d' ? '7-day' : w === '30d' ? '30-day' : '90-day'} rate
            </p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{fmt(data.windows[w])}%</p>
            {w === '7d' && (
              <span
                className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  delta7v30 >= 0
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {delta7v30 >= 0 ? '+' : ''}{fmt(delta7v30)} vs 30d
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Gauge + Engine chart row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 7-day radial gauge */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-medium text-slate-700 mb-3">7-day Citation Rate</p>
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart
              innerRadius="60%"
              outerRadius="90%"
              data={gaugeData}
              startAngle={180}
              endAngle={0}
            >
              <RadialBar background dataKey="value" cornerRadius={8} max={100} />
            </RadialBarChart>
          </ResponsiveContainer>
          <p className="text-center text-2xl font-bold text-blue-600 -mt-4">{fmt(data.windows['7d'])}%</p>
        </div>

        {/* Engine bar chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-medium text-slate-700 mb-3">Rate by Engine (30d)</p>
          {engineData.length === 0 ? (
            <p className="text-sm text-slate-400">No engine data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={engineData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="engine" width={72} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${fmt(v)}%`, 'Citation rate']} />
                <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                  {engineData.map((_, i) => (
                    <Cell key={i} fill={ENGINE_COLORS[i % ENGINE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Intent breakdown */}
      {intentData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-medium text-slate-700 mb-3">Rate by Intent Type (30d)</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={intentData} layout="vertical" margin={{ left: 16, right: 32 }}>
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="intent" width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${fmt(v)}%`, 'Citation rate']} />
              <Bar dataKey="rate" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 w-48 bg-slate-200 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => <div key={i} className="h-28 bg-slate-100 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-64 bg-slate-100 rounded-xl" />
        <div className="h-64 bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
}
