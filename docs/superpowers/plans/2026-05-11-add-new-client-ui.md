# Add New Client UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "+ Add Client" button to the `/dashboard` page and a full new-client form at `/dashboard/new-client`, backed by two Next.js proxy routes.

**Architecture:** The `/dashboard` page is refactored from an auto-redirect into a client picker (SSR server component) that lists all clients as clickable cards plus an "+ Add Client" button. The new-client form is a `'use client'` page that fetches verticals from a new GET proxy route, submits to a new POST proxy route, and redirects to the new client's overview on success.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, `cookies()` server API, `useRouter` + `useState` client hooks.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `frontend/app/dashboard/page.tsx` | Client list + "+ Add Client" button (SSR) |
| Create | `frontend/app/dashboard/new-client/page.tsx` | New-client form ('use client') |
| Create | `frontend/app/api/clients/route.ts` | POST proxy → `/tenants/me/clients` |
| Create | `frontend/app/api/verticals/route.ts` | GET proxy → `/verticals` |

### DTO reference (`POST /tenants/me/clients`)

```ts
// app/tenants/dto/create-client.dto.ts (backend — do not modify)
{
  verticalId: string;      // required — ID from GET /verticals
  name: string;            // required — "Client Name" in form
  brandName: string;       // required — "Brand Name" in form
  aliases: string[];       // required (empty array OK) — parse comma-separated input
  city: string;            // required
  state: string;           // required
  websiteUrl: string;      // required (@IsUrl(), no @IsOptional — must be a valid URL)
}
```

---

## Task 1: GET proxy route for verticals

**Files:**
- Create: `frontend/app/api/verticals/route.ts`

- [ ] **Step 1: Create the route file**

```ts
// frontend/app/api/verticals/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function GET() {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let res: Response;
  try {
    res = await fetch(`${API_URL}/verticals`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'API unreachable' }, { status: 502 });
  }

  if (!res.ok) return NextResponse.json({ error: 'API error' }, { status: res.status });

  const data = await res.json();
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Verify the file compiles (no TypeScript errors)**

Run from `frontend/`:
```
npx tsc --noEmit
```
Expected: no output (zero errors).

---

## Task 2: POST proxy route for clients

**Files:**
- Create: `frontend/app/api/clients/route.ts`

- [ ] **Step 1: Create the route file**

```ts
// frontend/app/api/clients/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function POST(request: Request) {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/tenants/me/clients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ error: 'API unreachable' }, { status: 502 });
  }

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text || 'API error' }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 2: Verify the file compiles**

```
npx tsc --noEmit
```
Expected: no output.

---

## Task 3: New-client form page

**Files:**
- Create: `frontend/app/dashboard/new-client/page.tsx`

- [ ] **Step 1: Create the form page**

```tsx
// frontend/app/dashboard/new-client/page.tsx
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
    fetch('/api/verticals')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load verticals');
        return r.json() as Promise<Vertical[]>;
      })
      .then(data => {
        setVerticals(data);
        if (data.length > 0) setVerticalId(data[0].id);
      })
      .catch(() => setVerticalsError('Could not load verticals. Is the backend running?'));
  }, []);

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
            ← Back
          </Link>
        </div>

        {verticalsError && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{verticalsError}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Brand Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Brand Name <span className="text-red-500">*</span>
            </label>
            <input
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
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Client Name <span className="text-red-500">*</span>
            </label>
            <input
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
              <label className="block text-sm font-medium text-slate-700 mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="e.g. San Francisco"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <input
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
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Website URL <span className="text-red-500">*</span>
            </label>
            <input
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Aliases</label>
            <input
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
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Vertical <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={verticalId}
              onChange={e => setVerticalId(e.target.value)}
              disabled={verticals.length === 0}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-400"
            >
              {verticals.length === 0 && <option value="">Loading verticals…</option>}
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
```

- [ ] **Step 2: Verify the file compiles**

```
npx tsc --noEmit
```
Expected: no output.

---

## Task 4: Update dashboard index page — client list + Add Client button

**Files:**
- Modify: `frontend/app/dashboard/page.tsx`

- [ ] **Step 1: Replace the file content**

The page currently auto-redirects to the first client. Replace it with an SSR client-picker that shows all clients as cards plus an "+ Add Client" button.

```tsx
// frontend/app/dashboard/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

interface Client { id: string; brand_name: string; city?: string; state?: string }

export default async function DashboardIndex() {
  const token = cookies().get('aeo_access_token')?.value;
  if (!token) redirect('/login');

  let clients: Client[] = [];
  try {
    clients = await apiFetch<Client[]>('/tenants/me/clients', token);
  } catch (err) {
    console.error('[dashboard] /tenants/me/clients fetch failed:', err);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
            <p className="text-sm text-slate-500 mt-0.5">Select a client to view its dashboard</p>
          </div>
          <Link
            href="/dashboard/new-client"
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <span>+</span>
            <span>Add Client</span>
          </Link>
        </div>

        {clients.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-lg font-medium">No clients yet</p>
            <p className="text-sm mt-1">Click &ldquo;Add Client&rdquo; to onboard your first client.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map(client => (
              <Link
                key={client.id}
                href={`/dashboard/${client.id}/overview`}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <p className="text-base font-semibold text-slate-900 truncate">{client.brand_name}</p>
                {(client.city || client.state) && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    {[client.city, client.state].filter(Boolean).join(', ')}
                  </p>
                )}
                <p className="text-xs text-blue-600 mt-3 font-medium">Open dashboard →</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

```
npx tsc --noEmit
```
Expected: no output.

- [ ] **Step 3: Run next build to confirm all routes compile cleanly**

```
cd frontend && npx next build
```
Expected: build completes, lists routes including `/dashboard/new-client`, zero type errors, zero build errors.

---

## Task 5: Manual smoke test

With the backend running (`npm run start:dev` in project root) and frontend running (`npm run dev` in `frontend/`):

- [ ] Navigate to `http://localhost:3001/dashboard` — verify client cards render and the "+ Add Client" button is visible top-right.
- [ ] Click "+ Add Client" — verify redirect to `/dashboard/new-client`.
- [ ] Confirm vertical dropdown populates (fetched from backend).
- [ ] Fill in all required fields with valid data and submit.
- [ ] Verify redirect to `/dashboard/[newClientId]/overview` after creation.
- [ ] Navigate back to `/dashboard` — verify the new client card appears in the list.
- [ ] Test empty-state: if only one client existed, it now shows the list — confirm the card links correctly to its overview.

---

## Task 6: Commit

- [ ] **Stage and commit**

```bash
git add frontend/app/dashboard/page.tsx \
        frontend/app/dashboard/new-client/page.tsx \
        frontend/app/api/clients/route.ts \
        frontend/app/api/verticals/route.ts \
        docs/superpowers/plans/2026-05-11-add-new-client-ui.md
git commit -m "[TASK-008] feat: Add New Client UI — dashboard onboarding flow"
```

---

## Notes

- `websiteUrl` is **required** by the backend DTO (`@IsUrl()`, no `@IsOptional()`). The form enforces this with `type="url"` + `required`.
- `aliases` is sent as a `string[]`. The form parses comma-separated input and filters empty strings.
- The `POST /tenants/me/clients` endpoint requires `tenant_admin` role. If the logged-in user has a lower role, the proxy returns 403 — the form will display the error message.
- The `/dashboard/new-client` page has no sidebar (it is outside `[clientId]` layout) — intentional; follows same standalone pattern as `/login`.
- The `/dashboard` page no longer auto-redirects to the first client. This is intentional: users can now pick which client to open.
