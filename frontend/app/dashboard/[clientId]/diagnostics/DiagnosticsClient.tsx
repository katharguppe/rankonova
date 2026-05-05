'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AlertTriangle, CheckCircle2, RefreshCw, TrendingUp, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GapReport, OnSiteGaps, OffSiteGaps, RecommendedAction } from '@/lib/types';

interface Props {
  clientId: string;
  initial: GapReport | null;
}

async function fetchReport(url: string): Promise<GapReport | null> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<GapReport | null>;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreCard({ label, value, fmt }: { label: string; value: number; fmt: 'pct' | 'count' | 'score' }) {
  const display = fmt === 'pct'
    ? `${Math.round(value * 100)}%`
    : fmt === 'score'
    ? value.toFixed(1)
    : String(value);

  const level = fmt === 'pct'
    ? (value >= 0.7 ? 'good' : value >= 0.4 ? 'warn' : 'bad')
    : (value === 0 ? 'good' : value <= 2 ? 'warn' : 'bad');

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col gap-1">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className={cn(
        'text-2xl font-bold',
        level === 'good' ? 'text-emerald-600' : level === 'warn' ? 'text-amber-500' : 'text-red-500',
      )}>{display}</p>
      <div className={cn(
        'h-1 rounded-full mt-1',
        level === 'good' ? 'bg-emerald-100' : level === 'warn' ? 'bg-amber-100' : 'bg-red-100',
      )}>
        <div className={cn(
          'h-1 rounded-full',
          level === 'good' ? 'bg-emerald-500' : level === 'warn' ? 'bg-amber-400' : 'bg-red-400',
        )} style={{ width: fmt === 'pct' ? `${Math.round(value * 100)}%` : `${Math.min(100, value * 20)}%` }} />
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: RecommendedAction['priority'] }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide',
      priority === 'high' ? 'bg-red-100 text-red-700' :
      priority === 'medium' ? 'bg-amber-100 text-amber-700' :
      'bg-slate-100 text-slate-600',
    )}>{priority}</span>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-28 bg-slate-100 rounded-xl" />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DiagnosticsClient({ clientId, initial }: Props) {
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const { data: report, isLoading, mutate } = useSWR<GapReport | null>(
    `/api/diagnostics/${clientId}`,
    fetchReport,
    { fallbackData: initial, revalidateOnFocus: false },
  );

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch(`/api/diagnostics/${clientId}/generate`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `Error ${res.status}`);
      }
      await mutate();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Diagnostics</h1>
          {report && (
            <p className="text-xs text-slate-500 mt-0.5">
              Report v{report.version} &mdash; generated {new Date(report.generated_at).toLocaleString('en-IN')}
              {report.top_cited_domain && (
                <> &mdash; top competitor domain: <span className="font-medium text-slate-700">{report.top_cited_domain}</span></>
              )}
            </p>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            generating
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700',
          )}
        >
          <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
          {generating ? 'Generating…' : 'Generate New Report'}
        </button>
      </div>

      {/* Generate note */}
      {generating && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertTriangle size={14} className="shrink-0" />
          Crawling your site and competitors — this takes 30–60 seconds. Please wait.
        </div>
      )}

      {/* Error */}
      {generateError && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <XCircle size={14} className="shrink-0" />
          {generateError}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !report && <Skeleton />}

      {/* Empty state */}
      {!isLoading && !report && !generating && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <TrendingUp size={40} className="text-slate-300 mb-4" />
          <p className="text-slate-600 font-medium">No report yet</p>
          <p className="text-sm text-slate-400 mt-1">Click "Generate New Report" to run the first gap analysis.</p>
        </div>
      )}

      {/* Report content */}
      {report && (
        <>
          {/* Plain English Summary */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Summary</h2>
            <p className="text-slate-800 leading-relaxed whitespace-pre-line">{report.plain_english_summary}</p>
          </div>

          {/* On-Site Gaps */}
          <div>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">On-Site Gaps</h2>
            <OnSiteGapsGrid gaps={report.on_site_gaps} />
          </div>

          {/* Off-Site Gaps */}
          <div>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Off-Site Gaps</h2>
            <OffSiteGapsGrid gaps={report.off_site_gaps} />
          </div>

          {/* Recommended Actions */}
          <div>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
              Recommended Actions <span className="text-slate-400 font-normal normal-case">(ordered by citation impact)</span>
            </h2>
            <div className="space-y-2">
              {report.recommended_actions.map((item, i) => (
                <div
                  key={i}
                  className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-start gap-4"
                >
                  <span className="text-xs text-slate-400 font-mono w-5 shrink-0 mt-0.5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800">{item.action}</p>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <CheckCircle2 size={11} className="text-emerald-500" />
                      {item.estimated_impact}
                    </p>
                  </div>
                  <PriorityBadge priority={item.priority} />
                </div>
              ))}
              {report.recommended_actions.length === 0 && (
                <p className="text-sm text-slate-400">No recommended actions generated.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Gap grids ─────────────────────────────────────────────────────────────────

function OnSiteGapsGrid({ gaps }: { gaps: OnSiteGaps }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <ScoreCard label="FAQ Coverage" value={gaps.faq_coverage_score} fmt="pct" />
      <ScoreCard label="Freshness Gap" value={gaps.freshness_gap} fmt="score" />
      <ScoreCard label="Entity Density Gap" value={gaps.entity_density_gap} fmt="score" />
      <ScoreCard label="Internal Link Gap" value={gaps.internal_link_gap} fmt="score" />
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col gap-1 sm:col-span-1 col-span-2">
        <p className="text-xs text-slate-500 font-medium">Missing Schema Types</p>
        {gaps.missing_schema_types.length === 0 ? (
          <p className="text-sm text-emerald-600 font-semibold">None</p>
        ) : (
          <div className="flex flex-wrap gap-1 mt-1">
            {gaps.missing_schema_types.map((t) => (
              <span key={t} className="text-xs bg-red-50 text-red-700 border border-red-100 rounded px-1.5 py-0.5">{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OffSiteGapsGrid({ gaps }: { gaps: OffSiteGaps }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <ScoreCard label="Aggregator Presence" value={gaps.aggregator_presence} fmt="pct" />
      <ScoreCard label="Review Volume Gap" value={gaps.review_volume_gap} fmt="score" />
      <ScoreCard label="Community Presence" value={gaps.community_presence} fmt="pct" />
      <ScoreCard label="Entity Recognition" value={gaps.entity_recognition} fmt="pct" />
      <ScoreCard label="PR Coverage" value={gaps.pr_coverage} fmt="pct" />
    </div>
  );
}
