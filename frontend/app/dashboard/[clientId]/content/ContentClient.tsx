'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { X, Eye, CheckCircle, RotateCcw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentListItem, ContentStatus, ContentType } from '@/lib/types';

// ── Static maps ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ContentType, string> = {
  faq_page: 'FAQ Page',
  comparison_page: 'Comparison',
  entity_authority_page: 'Entity Authority',
  segment_article: 'Article',
};

const TYPE_COLORS: Record<ContentType, string> = {
  faq_page: 'bg-violet-50 text-violet-700',
  comparison_page: 'bg-cyan-50 text-cyan-700',
  entity_authority_page: 'bg-orange-50 text-orange-700',
  segment_article: 'bg-pink-50 text-pink-700',
};

const STATUS_LABELS: Record<ContentStatus, string> = {
  draft: 'Draft',
  approved: 'Approved',
  revision_requested: 'Revision Requested',
  published: 'Published',
};

const STATUS_COLORS: Record<ContentStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  approved: 'bg-emerald-50 text-emerald-700',
  revision_requested: 'bg-amber-50 text-amber-700',
  published: 'bg-blue-50 text-blue-700',
};

const TABS: { label: string; value: ContentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Approved', value: 'approved' },
  { label: 'Revision Requested', value: 'revision_requested' },
  { label: 'Published', value: 'published' },
];

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function fetchList(clientId: string): Promise<ContentListItem[]> {
  const res = await fetch(`/api/content/${clientId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load content');
  return res.json();
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  clientId: string;
  initial: ContentListItem[];
}

export default function ContentClient({ clientId, initial }: Props) {
  const { data, isLoading, mutate } = useSWR<ContentListItem[]>(
    ['content', clientId],
    () => fetchList(clientId),
    { fallbackData: initial, refreshInterval: 300_000 },
  );

  const [activeTab, setActiveTab] = useState<ContentStatus | 'all'>('all');

  // Preview modal state
  const [previewItem, setPreviewItem] = useState<ContentListItem | null>(null);

  // Revision modal state
  const [revisionItem, setRevisionItem] = useState<ContentListItem | null>(null);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [revisionError, setRevisionError] = useState('');

  // Per-row action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = (data ?? []).filter(
    (item) => activeTab === 'all' || item.status === activeTab,
  );

  // Tab counts
  const countFor = (tab: ContentStatus | 'all') =>
    tab === 'all'
      ? (data ?? []).length
      : (data ?? []).filter((i) => i.status === tab).length;

  // ── Actions ─────────────────────────────────────────────────────────────────

  function openPreview(item: ContentListItem) {
    setPreviewItem(item);
  }

  function closePreview() {
    setPreviewItem(null);
  }

  async function handleApprove(item: ContentListItem) {
    setActionLoading(item.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/content/output/${item.id}/approve`, { method: 'PATCH' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Approve failed');
      }
      await mutate();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setActionLoading(null);
    }
  }

  function openRevision(item: ContentListItem) {
    setRevisionItem(item);
    setRevisionNotes('');
    setRevisionError('');
  }

  async function submitRevision() {
    if (!revisionItem) return;
    if (revisionNotes.trim().length < 10) {
      setRevisionError('Notes must be at least 10 characters.');
      return;
    }
    setActionLoading(revisionItem.id);
    setRevisionError('');
    try {
      const res = await fetch(`/api/content/output/${revisionItem.id}/request-revision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewNotes: revisionNotes.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Request failed');
      }
      await mutate();
      setRevisionItem(null);
    } catch (e) {
      setRevisionError((e as Error).message);
    } finally {
      setActionLoading(null);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Content</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Review, approve, and manage AEO content drafts
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-slate-200">
          {TABS.map((tab) => {
            const count = countFor(tab.value);
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  activeTab === tab.value
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900',
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'ml-1.5 px-1.5 py-0.5 text-xs rounded-full',
                      activeTab === tab.value
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Action error banner */}
        {actionError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {/* Content table */}
        {isLoading && initial.length === 0 ? (
          <ContentSkeleton />
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <p className="text-sm text-slate-400">
              {activeTab === 'all'
                ? 'No content generated yet. Use the API to generate your first piece.'
                : `No ${STATUS_LABELS[activeTab as ContentStatus]?.toLowerCase()} content.`}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Title
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">
                    Created
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <ContentRow
                    key={item.id}
                    item={item}
                    busy={actionLoading === item.id}
                    onPreview={() => openPreview(item)}
                    onApprove={() => handleApprove(item)}
                    onRevision={() => openRevision(item)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Preview modal ─────────────────────────────────────────────────────── */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60">
          <div className="flex items-center justify-between bg-white px-5 py-3 border-b border-slate-200 shrink-0">
            <div>
              <p className="text-sm font-semibold text-slate-900 truncate max-w-lg">
                {previewItem.title}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {TYPE_LABELS[previewItem.type]} &middot;{' '}
                {STATUS_LABELS[previewItem.status]}
              </p>
            </div>
            <button
              onClick={closePreview}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label="Close preview"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden bg-white">
            <iframe
              key={previewItem.id}
              srcDoc={previewItem.html_content}
              sandbox="allow-scripts allow-same-origin"
              className="w-full h-full border-0"
              title="Content preview"
            />
          </div>
        </div>
      )}

      {/* ── Revision modal ────────────────────────────────────────────────────── */}
      {revisionItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">Request Revision</p>
              <button
                onClick={() => setRevisionItem(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-slate-500 truncate">{revisionItem.title}</p>
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={5}
                placeholder="Describe what needs to change (minimum 10 characters)…"
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
              />
              {revisionError && (
                <p className="text-xs text-red-600">{revisionError}</p>
              )}
            </div>
            <div className="flex gap-2 justify-end px-5 py-4 border-t border-slate-100">
              <button
                onClick={() => setRevisionItem(null)}
                className="px-4 py-2 text-sm text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitRevision}
                disabled={actionLoading === revisionItem.id}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {actionLoading === revisionItem.id && (
                  <Loader2 size={13} className="animate-spin" />
                )}
                Request Revision
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Row sub-component ─────────────────────────────────────────────────────────

interface RowProps {
  item: ContentListItem;
  busy: boolean;
  onPreview: () => void;
  onApprove: () => void;
  onRevision: () => void;
}

function ContentRow({ item, busy, onPreview, onApprove, onRevision }: RowProps) {
  const issueCount = item.review_notes
    ? parseInt(item.review_notes.match(/^(\d+)/)?.[1] ?? '0', 10)
    : 0;

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      {/* Title */}
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900 truncate max-w-xs">{item.title}</p>
        {issueCount > 0 && (
          <p className="text-xs text-amber-600 mt-0.5">{issueCount} validation issue{issueCount !== 1 ? 's' : ''}</p>
        )}
      </td>

      {/* Type badge */}
      <td className="px-4 py-3 hidden sm:table-cell">
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
            TYPE_COLORS[item.type],
          )}
        >
          {TYPE_LABELS[item.type]}
        </span>
      </td>

      {/* Status badge */}
      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
            STATUS_COLORS[item.status],
          )}
        >
          {STATUS_LABELS[item.status]}
        </span>
      </td>

      {/* Created date */}
      <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell whitespace-nowrap">
        {new Date(item.created_at).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 justify-end">
          {/* Preview */}
          <button
            onClick={onPreview}
            title="Preview HTML"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Eye size={12} />
            <span className="hidden sm:inline">Preview</span>
          </button>

          {/* Approve — draft only */}
          {item.status === 'draft' && (
            <button
              onClick={onApprove}
              disabled={busy}
              title="Approve"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {busy ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <CheckCircle size={12} />
              )}
              <span className="hidden sm:inline">Approve</span>
            </button>
          )}

          {/* Request Revision — draft or approved */}
          {(item.status === 'draft' || item.status === 'approved') && (
            <button
              onClick={onRevision}
              disabled={busy}
              title="Request Revision"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
            >
              <RotateCcw size={12} />
              <span className="hidden sm:inline">Revision</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ContentSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse">
      <div className="h-10 bg-slate-50 border-b border-slate-100" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 px-4 py-4 border-b border-slate-100 last:border-0">
          <div className="flex-1 h-4 bg-slate-100 rounded" />
          <div className="w-20 h-4 bg-slate-100 rounded hidden sm:block" />
          <div className="w-16 h-4 bg-slate-100 rounded" />
          <div className="w-24 h-4 bg-slate-100 rounded hidden md:block" />
          <div className="w-24 h-4 bg-slate-100 rounded" />
        </div>
      ))}
    </div>
  );
}
