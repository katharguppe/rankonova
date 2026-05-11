'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Vertical { id: string; name: string }
interface CreatedClient { id: string }

export default function NewClientPage() {
  const router = useRouter();

  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [verticalsError, setVerticalsError] = useState('');

  // Form state
  const [brandName, setBrandName] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [aliases, setAliases] = useState('');
  const [verticalId, setVerticalId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/verticals')
      .then(r => {
        if (r.status === 401) {
          router.push('/login');
          return null;
        }
        if (!r.ok) throw new Error('Failed to load verticals');
        return r.json() as Promise<Vertical[]>;
      })
      .then(data => {
        if (cancelled || !data) return;
        setVerticals(data);
        if (data.length > 0) setVerticalId(data[0].id);
      })
      .catch(() => {
        if (!cancelled) setVerticalsError('Could not load verticals. Is the backend running?');
      });
    return () => { cancelled = true; };
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);

    const aliasArray = aliases
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName,
          name,
          city,
          state,
          websiteUrl,
          aliases: aliasArray,
          verticalId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string; message?: string[] | string };
        const msg = err.message
          ? Array.isArray(err.message) ? err.message.join(', ') : err.message
          : err.error ?? 'Failed to create client';
        setSubmitError(msg);
        return;
      }

      const client = await res.json() as CreatedClient;
      router.push(`/dashboard/${client.id}/overview`);
    } catch {
      setSubmitError('Could not reach server.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Add New Client</h1>
            <p className="text-sm text-slate-500 mt-0.5">Fill in the details to onboard a new client.</p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            &larr; Back
          </Link>
        </div>

        {verticalsError && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{verticalsError}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Brand Name */}
          <div>
            <label htmlFor="brandName" className="block text-sm font-medium text-slate-700 mb-1">
              Brand Name <span className="text-red-500">*</span>
            </label>
            <input
              id="brandName"
              type="text"
              required
              minLength={2}
              maxLength={100}
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Client Name */}
          <div>
            <label htmlFor="clientName" className="block text-sm font-medium text-slate-700 mb-1">
              Client Name <span className="text-red-500">*</span>
            </label>
            <input
              id="clientName"
              type="text"
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Acme Corporation Ltd."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* City + State row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-slate-700 mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <input
                id="city"
                type="text"
                required
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="e.g. San Francisco"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-slate-700 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <input
                id="state"
                type="text"
                required
                value={state}
                onChange={e => setState(e.target.value)}
                placeholder="e.g. CA"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Website URL */}
          <div>
            <label htmlFor="websiteUrl" className="block text-sm font-medium text-slate-700 mb-1">
              Website URL <span className="text-red-500">*</span>
            </label>
            <input
              id="websiteUrl"
              type="url"
              required
              value={websiteUrl}
              onChange={e => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Aliases */}
          <div>
            <label htmlFor="aliases" className="block text-sm font-medium text-slate-700 mb-1">Aliases</label>
            <input
              id="aliases"
              type="text"
              value={aliases}
              onChange={e => setAliases(e.target.value)}
              placeholder="e.g. Acme, ACME Corp"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">Comma-separated. Leave blank if none.</p>
          </div>

          {/* Vertical */}
          <div>
            <label htmlFor="verticalId" className="block text-sm font-medium text-slate-700 mb-1">
              Vertical <span className="text-red-500">*</span>
            </label>
            <select
              id="verticalId"
              required
              value={verticalId}
              onChange={e => setVerticalId(e.target.value)}
              disabled={verticals.length === 0}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-400"
            >
              {verticals.length === 0 && (
                <option value="">{verticalsError ? 'Unavailable' : 'Loading verticals…'}</option>
              )}
              {verticals.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          {submitError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{submitError}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting || verticals.length === 0}
              className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {submitting ? 'Creating…' : 'Create Client'}
            </button>
            <Link
              href="/dashboard"
              className="py-2 px-4 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
