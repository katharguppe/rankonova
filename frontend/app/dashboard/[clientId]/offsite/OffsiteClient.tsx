'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Play, ChevronDown, ChevronRight, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  AggregatorSnapshot,
  ReviewAudit,
  CommunityThread,
  EntityCheck,
  PrSignal,
  PrSignalStatus,
} from '@/lib/types';

interface Props {
  clientId: string;
  initialAggregator: AggregatorSnapshot[];
}

const TABS = [
  { id: 'aggregator',      label: 'Aggregator'      },
  { id: 'reviews',         label: 'Reviews'         },
  { id: 'community',       label: 'Community'       },
  { id: 'knowledge-graph', label: 'Knowledge Graph' },
  { id: 'pr',              label: 'PR'              },
] as const;

type TabId = typeof TABS[number]['id'];

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

// ── Shared ────────────────────────────────────────────────────────────────────

function RunButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
        loading
          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
          : 'bg-blue-600 text-white hover:bg-blue-700',
      )}
    >
      <Play size={11} className={loading ? 'animate-pulse' : ''} />
      {loading ? 'Running…' : 'Run Now'}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-16 text-center text-slate-400 text-sm">{message}</div>
  );
}

function TabError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-4">
      <XCircle size={14} className="shrink-0" />
      {message}
    </div>
  );
}

// ── Aggregator tab ────────────────────────────────────────────────────────────

function AggregatorTab({ snapshots }: { snapshots: AggregatorSnapshot[] }) {
  if (!snapshots.length) return <EmptyState message="No aggregator snapshots yet — click Run Now to crawl profiles." />;

  return (
    <div className="space-y-4">
      {snapshots.map((snap) => (
        <div key={snap.id} className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold text-slate-900">{snap.platform}</p>
              <a
                href={snap.profile_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
              >
                {snap.profile_url.slice(0, 60)}{snap.profile_url.length > 60 ? '…' : ''}
                <ExternalLink size={10} />
              </a>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">{snap.completeness_score.toFixed(0)}%</p>
              <p className="text-xs text-slate-400">completeness</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-slate-100 rounded-full mb-4">
            <div
              className={cn('h-2 rounded-full', snap.completeness_score >= 70 ? 'bg-emerald-500' : snap.completeness_score >= 40 ? 'bg-amber-400' : 'bg-red-400')}
              style={{ width: `${snap.completeness_score}%` }}
            />
          </div>

          {snap.fields_missing.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-slate-500 mb-1.5">Missing fields</p>
              <div className="flex flex-wrap gap-1">
                {snap.fields_missing.map((f) => (
                  <span key={f} className="text-xs bg-red-50 text-red-700 border border-red-100 rounded px-1.5 py-0.5">{f}</span>
                ))}
              </div>
            </div>
          )}

          {snap.update_pack.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">Suggestions</p>
              <ol className="space-y-1">
                {snap.update_pack.slice(0, 5).map((u, i) => (
                  <li key={i} className="text-xs text-slate-700 flex gap-2">
                    <span className="text-slate-400 font-mono shrink-0">{i + 1}.</span>
                    <span><span className="font-medium">{u.field}:</span> {u.suggestion}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <p className="text-xs text-slate-400 mt-3">Crawled {new Date(snap.crawled_at).toLocaleString('en-IN')}</p>
        </div>
      ))}
    </div>
  );
}

// ── Reviews tab ───────────────────────────────────────────────────────────────

function ReviewsTab({ audits }: { audits: ReviewAudit[] }) {
  if (!audits.length) return <EmptyState message="No review audits yet — click Run Now to scan review platforms." />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {audits.map((audit) => (
        <div key={audit.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-900">{audit.platform}</p>
            {audit.negative_count > 0 && (
              <span className="text-xs bg-red-100 text-red-700 font-medium px-2 py-0.5 rounded-full">
                {audit.negative_count} negative
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xl font-bold text-slate-900">{audit.review_count}</p>
              <p className="text-xs text-slate-400">reviews</p>
            </div>
            <div>
              <p className="text-xl font-bold text-amber-500">{audit.average_rating.toFixed(1)}</p>
              <p className="text-xs text-slate-400">avg rating</p>
            </div>
            <div>
              <p className="text-xl font-bold text-blue-600">{audit.review_velocity?.toFixed(1) ?? '—'}</p>
              <p className="text-xs text-slate-400">velocity</p>
            </div>
          </div>
          <p className="text-xs text-slate-400">Updated {new Date(audit.updated_at).toLocaleString('en-IN')}</p>
        </div>
      ))}
    </div>
  );
}

// ── Community tab ─────────────────────────────────────────────────────────────

function CommunityTab({ threads }: { threads: CommunityThread[] }) {
  const [opOnly, setOpOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = opOnly
    ? threads.filter((t) => t.is_competitor_recommended && !t.is_client_mentioned)
    : threads;

  if (!threads.length) return <EmptyState message="No community threads yet — click Run Now to scan." />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpOnly(false)}
          className={cn('px-3 py-1 rounded-full text-xs font-medium transition-colors',
            !opOnly ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
        >All ({threads.length})</button>
        <button
          onClick={() => setOpOnly(true)}
          className={cn('px-3 py-1 rounded-full text-xs font-medium transition-colors',
            opOnly ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
        >
          Opportunities ({threads.filter((t) => t.is_competitor_recommended && !t.is_client_mentioned).length})
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Thread</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Platform</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Comp</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Us</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((t) => (
              <>
                <tr
                  key={t.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {expandedId === t.id ? <ChevronDown size={12} className="text-slate-400 shrink-0" /> : <ChevronRight size={12} className="text-slate-400 shrink-0" />}
                      <span className="text-slate-800 line-clamp-1">{t.thread_title}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-500 hidden sm:table-cell">{t.platform}</td>
                  <td className="px-3 py-3 text-center">
                    {t.is_competitor_recommended
                      ? <span className="inline-block w-2 h-2 rounded-full bg-red-400" title="Competitor mentioned" />
                      : <span className="inline-block w-2 h-2 rounded-full bg-slate-200" />}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {t.is_client_mentioned
                      ? <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" title="Client mentioned" />
                      : <span className="inline-block w-2 h-2 rounded-full bg-slate-200" />}
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                      t.response_status === 'posted' ? 'bg-emerald-100 text-emerald-700' :
                      t.response_status === 'skipped' ? 'bg-slate-100 text-slate-500' :
                      'bg-amber-100 text-amber-700'
                    )}>{t.response_status}</span>
                  </td>
                </tr>
                {expandedId === t.id && t.response_draft && (
                  <tr key={`${t.id}-draft`} className="bg-blue-50">
                    <td colSpan={5} className="px-6 py-3">
                      <p className="text-xs font-semibold text-slate-500 mb-1">Draft response</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{t.response_draft}</p>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">No threads match this filter.</p>
        )}
      </div>
    </div>
  );
}

// ── Knowledge Graph tab ───────────────────────────────────────────────────────

function KnowledgeGraphTab({ check }: { check: EntityCheck | null }) {
  const [draftOpen, setDraftOpen] = useState(false);

  if (!check) return <EmptyState message="No entity check yet — click Run Now to scan Wikidata, GKP, and Wikipedia." />;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">Last checked {new Date(check.checked_at).toLocaleString('en-IN')}</p>

      {/* 3 status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Wikidata */}
        <div className={cn('border rounded-xl p-5', check.wikidata_found ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50')}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Wikidata</p>
          <div className="flex items-center gap-2">
            {check.wikidata_found
              ? <CheckCircle2 size={18} className="text-emerald-600" />
              : <XCircle size={18} className="text-red-500" />}
            <p className={cn('font-semibold', check.wikidata_found ? 'text-emerald-700' : 'text-red-700')}>
              {check.wikidata_found ? 'Entity found' : 'Not found'}
            </p>
          </div>
          {check.wikidata_qid && (
            <a
              href={`https://www.wikidata.org/wiki/${check.wikidata_qid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-2"
            >
              {check.wikidata_qid} <ExternalLink size={10} />
            </a>
          )}
        </div>

        {/* GKP */}
        <div className={cn('border rounded-xl p-5', check.gkp_detected ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white')}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Knowledge Panel</p>
          <div className="flex items-center gap-2">
            {check.gkp_detected
              ? <CheckCircle2 size={18} className="text-emerald-600" />
              : <XCircle size={18} className="text-slate-400" />}
            <p className={cn('font-semibold', check.gkp_detected ? 'text-emerald-700' : 'text-slate-500')}>
              {check.gkp_detected ? 'Detected' : 'Not detected'}
            </p>
          </div>
          {check.gkp_snapshot?.title && (
            <p className="text-xs text-slate-600 mt-2">{check.gkp_snapshot.title}</p>
          )}
        </div>

        {/* Wikipedia */}
        <div className={cn('border rounded-xl p-5',
          check.wikipedia_flag === 'threshold_met' ? 'border-emerald-200 bg-emerald-50' :
          check.wikipedia_flag === 'borderline' ? 'border-amber-200 bg-amber-50' :
          'border-slate-200 bg-white'
        )}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Wikipedia</p>
          <div className="flex items-center gap-2">
            {check.wikipedia_notable
              ? <CheckCircle2 size={18} className="text-emerald-600" />
              : <XCircle size={18} className={check.wikipedia_flag === 'borderline' ? 'text-amber-500' : 'text-slate-400'} />}
            <p className={cn('font-semibold',
              check.wikipedia_flag === 'threshold_met' ? 'text-emerald-700' :
              check.wikipedia_flag === 'borderline' ? 'text-amber-700' : 'text-slate-500'
            )}>
              {check.wikipedia_flag === 'threshold_met' ? 'Notable' :
               check.wikipedia_flag === 'borderline' ? 'Borderline' : 'Not notable'}
            </p>
          </div>
          {check.wikipedia_url && (
            <a href={check.wikipedia_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-2">
              View page <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>

      {/* Wikidata submission draft */}
      {!check.wikidata_found && check.wikidata_submission_draft && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setDraftOpen(!draftOpen)}
            className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700"
          >
            Wikidata submission draft
            {draftOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {draftOpen && (
            <pre className="px-5 py-4 text-xs text-slate-700 bg-white overflow-x-auto">
              {JSON.stringify(check.wikidata_submission_draft, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ── PR tab ────────────────────────────────────────────────────────────────────

const PR_STATUSES: PrSignalStatus[] = ['draft', 'approved', 'distributed', 'archived'];

function PrTab({
  signals,
  onApprove,
  onArchive,
  actionLoading,
}: {
  signals: PrSignal[];
  onApprove: (id: string) => void;
  onArchive: (id: string) => void;
  actionLoading: string | null;
}) {
  const [statusFilter, setStatusFilter] = useState<PrSignalStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = statusFilter === 'all'
    ? signals
    : signals.filter((s) => s.status === statusFilter);

  if (!signals.length) return <EmptyState message="No PR signals yet — click Run Now to scan RSS feeds." />;

  return (
    <div className="space-y-3">
      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5">
        {(['all', ...PR_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn('px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize',
              statusFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            {s} ({s === 'all' ? signals.length : signals.filter((x) => x.status === s).length})
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">News</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Source</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Score</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((sig) => (
              <>
                <tr
                  key={sig.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === sig.id ? null : sig.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {expandedId === sig.id ? <ChevronDown size={12} className="text-slate-400 shrink-0" /> : <ChevronRight size={12} className="text-slate-400 shrink-0" />}
                      <span className="text-slate-800 line-clamp-1">{sig.news_title}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-500 text-xs hidden sm:table-cell">{sig.news_source}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs text-slate-600">
                    {Math.round(sig.relevance_score * 100)}%
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize',
                      sig.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                      sig.status === 'distributed' ? 'bg-blue-100 text-blue-700' :
                      sig.status === 'archived' ? 'bg-slate-100 text-slate-500' :
                      'bg-amber-100 text-amber-700'
                    )}>{sig.status}</span>
                  </td>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1 justify-end">
                      {sig.status === 'draft' && (
                        <button
                          onClick={() => onApprove(sig.id)}
                          disabled={actionLoading === sig.id}
                          className="px-2 py-1 text-xs rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 font-medium"
                        >
                          {actionLoading === sig.id ? '…' : 'Approve'}
                        </button>
                      )}
                      {(sig.status === 'draft' || sig.status === 'approved') && (
                        <button
                          onClick={() => onArchive(sig.id)}
                          disabled={actionLoading === sig.id}
                          className="px-2 py-1 text-xs rounded bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 font-medium"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedId === sig.id && (
                  <tr key={`${sig.id}-detail`} className="bg-slate-50">
                    <td colSpan={5} className="px-6 py-4 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-1">PR Angle</p>
                        <p className="text-sm text-slate-700">{sig.pr_angle}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-1">Press Release Draft</p>
                        <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{sig.press_release_draft}</pre>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-1">
                          Distribution ({sig.distribution_checklist.length} contacts)
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {sig.distribution_checklist.map((c, i) => (
                            <span key={i} className={cn('text-xs px-2 py-0.5 rounded border',
                              c.wire_service ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                            )}>{c.outlet}</span>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">No signals with status "{statusFilter}".</p>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OffsiteClient({ clientId, initialAggregator }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('aggregator');
  const [visited, setVisited] = useState<Set<TabId>>(new Set<TabId>(['aggregator']));
  const [running, setRunning] = useState<TabId | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  function activateTab(id: TabId) {
    setActiveTab(id);
    setRunError(null);
    setVisited((prev) => new Set<TabId>([...Array.from(prev), id]));
  }

  // Per-tab SWR — key is null until tab has been visited (lazy load)
  const { data: aggData, mutate: mutateAgg } = useSWR<AggregatorSnapshot[]>(
    visited.has('aggregator') ? `/api/offsite/${clientId}/aggregator` : null,
    fetcher, { fallbackData: initialAggregator, revalidateOnFocus: false },
  );
  const { data: revData, mutate: mutateRev } = useSWR<ReviewAudit[]>(
    visited.has('reviews') ? `/api/offsite/${clientId}/reviews` : null,
    fetcher, { fallbackData: [], revalidateOnFocus: false },
  );
  const { data: comData, mutate: mutateCom } = useSWR<CommunityThread[]>(
    visited.has('community') ? `/api/offsite/${clientId}/community` : null,
    fetcher, { fallbackData: [], revalidateOnFocus: false },
  );
  const { data: kgData, mutate: mutateKg } = useSWR<EntityCheck | null>(
    visited.has('knowledge-graph') ? `/api/offsite/${clientId}/knowledge-graph` : null,
    fetcher, { fallbackData: null, revalidateOnFocus: false },
  );
  const { data: prData, mutate: mutatePr } = useSWR<PrSignal[]>(
    visited.has('pr') ? `/api/offsite/${clientId}/pr` : null,
    fetcher, { fallbackData: [], revalidateOnFocus: false },
  );

  const mutateMap: Record<TabId, () => void> = {
    aggregator: () => { void mutateAgg(); },
    reviews: () => { void mutateRev(); },
    community: () => { void mutateCom(); },
    'knowledge-graph': () => { void mutateKg(); },
    pr: () => { void mutatePr(); },
  };

  async function handleRun() {
    setRunning(activeTab);
    setRunError(null);
    try {
      const res = await fetch(`/api/offsite/${clientId}/${activeTab}/run`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `Error ${res.status}`);
      }
      mutateMap[activeTab]();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRunning(null);
    }
  }

  async function handleApprove(signalId: string) {
    setActionLoading(signalId);
    try {
      const res = await fetch(`/api/offsite/signal/${signalId}/approve`, { method: 'PATCH' });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      void mutatePr();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleArchive(signalId: string) {
    setActionLoading(signalId);
    try {
      const res = await fetch(`/api/offsite/signal/${signalId}/archive`, { method: 'PATCH' });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      void mutatePr();
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Off-Site Builder</h1>
        <RunButton onClick={handleRun} loading={running === activeTab} />
      </div>

      {runError && <TabError message={runError} />}

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 gap-0">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => activateTab(id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'aggregator' && <AggregatorTab snapshots={aggData ?? []} />}
        {activeTab === 'reviews' && <ReviewsTab audits={revData ?? []} />}
        {activeTab === 'community' && <CommunityTab threads={comData ?? []} />}
        {activeTab === 'knowledge-graph' && <KnowledgeGraphTab check={kgData ?? null} />}
        {activeTab === 'pr' && (
          <PrTab
            signals={prData ?? []}
            onApprove={handleApprove}
            onArchive={handleArchive}
            actionLoading={actionLoading}
          />
        )}
      </div>
    </div>
  );
}
