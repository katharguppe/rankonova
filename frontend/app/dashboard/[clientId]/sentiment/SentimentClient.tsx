'use client';

import useSWR from 'swr';
import { proxyFetch } from '@/lib/api';
import { fmt } from '@/lib/utils';
import type { SentimentAnalysis } from '@/lib/types';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface Props {
  clientId: string;
  initial: SentimentAnalysis | null;
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#10b981',
  negative: '#ef4444',
  neutral: '#94a3b8',
  mixed: '#f59e0b',
};

const SENTIMENT_BADGE: Record<string, string> = {
  positive: 'bg-emerald-100 text-emerald-700',
  negative: 'bg-red-100 text-red-700',
  neutral: 'bg-slate-100 text-slate-600',
  mixed: 'bg-amber-100 text-amber-700',
};

export default function SentimentClient({ clientId, initial }: Props) {
  const { data, isLoading } = useSWR<SentimentAnalysis>(
    ['sentiment', clientId],
    () => proxyFetch<SentimentAnalysis>(clientId, 'sentiment'),
    { fallbackData: initial ?? undefined, refreshInterval: 300_000 },
  );

  if (isLoading && !data) {
    return <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />;
  }

  if (!data) {
    return <p className="text-slate-400 text-sm">No sentiment data yet.</p>;
  }

  const total = data.overall.positive + data.overall.negative + data.overall.neutral + data.overall.mixed;

  const pieData = [
    { name: 'Positive', value: data.overall.positive, fill: SENTIMENT_COLORS.positive },
    { name: 'Negative', value: data.overall.negative, fill: SENTIMENT_COLORS.negative },
    { name: 'Neutral', value: data.overall.neutral, fill: SENTIMENT_COLORS.neutral },
    { name: 'Mixed', value: data.overall.mixed, fill: SENTIMENT_COLORS.mixed },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Sentiment Analysis</h1>
        <p className="text-sm text-slate-500 mt-0.5">Brand mention tone over the last 30 days</p>
      </div>

      {/* Donut + stats row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-medium text-slate-700 mb-3">Overall Sentiment</p>
          {total === 0 ? (
            <p className="text-sm text-slate-400">No sentiment data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="80%"
                  dataKey="value"
                  paddingAngle={2}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} mentions`]} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-medium text-slate-700 mb-4">Breakdown</p>
          <div className="space-y-3">
            {(['positive', 'negative', 'neutral', 'mixed'] as const).map(s => {
              const count = data.overall[s];
              const pct = total === 0 ? 0 : Math.round((count / total) * 100);
              return (
                <div key={s}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize text-slate-700">{s}</span>
                    <span className="text-slate-500">{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: SENTIMENT_COLORS[s] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 30d trend */}
      {data.trend.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-medium text-slate-700 mb-3">30-Day Trend</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.trend} margin={{ left: 0, right: 16 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend iconType="circle" iconSize={8} />
              <Line type="monotone" dataKey="positive" stroke={SENTIMENT_COLORS.positive} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="negative" stroke={SENTIMENT_COLORS.negative} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="neutral" stroke={SENTIMENT_COLORS.neutral} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="mixed" stroke={SENTIMENT_COLORS.mixed} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Context snippets */}
      {data.snippets.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-700">Recent Context Snippets</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {data.snippets.map((s, i) => (
              <li key={i} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${SENTIMENT_BADGE[s.sentiment] ?? 'bg-slate-100 text-slate-600'}`}
                  >
                    {s.sentiment}
                  </span>
                  <p className="text-sm text-slate-700 leading-relaxed">{s.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
