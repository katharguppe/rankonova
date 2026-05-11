# Register Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a registration page, its proxy route, and a cross-link from the login page so new users can sign up without backend access.

**Architecture:** Three small files — a Next.js proxy route (`/api/auth/register`) that forwards to `POST /auth/register`, a standalone `'use client'` form page at `/register`, and a one-line link addition to the existing login page. The backend `RegisterDto` requires `tenantSlug` and `billingEmail` in addition to what the UI collects; both are derived silently on the frontend (`tenantSlug` from `tenantName`, `billingEmail` = `email`).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS.

---

## DTO Reference (backend — do not modify)

```ts
// app/auth/dto/register.dto.ts
{
  email: string;        // IsEmail
  password: string;     // Length 8-72
  tenantName: string;   // Length 2-100
  tenantSlug: string;   // Length 2-50, /^[a-z0-9-]+$/
  billingEmail: string; // IsEmail — send same as email
}
```

Backend returns `{ message: string; verificationToken: string }` on 201 success.
On conflict (email or slug taken): 409 with `{ message: string }`.
On validation error: 400 with `{ message: string[] }`.

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `frontend/app/api/auth/register/route.ts` | POST proxy → `/auth/register`, no cookie |
| Create | `frontend/app/register/page.tsx` | Registration form, success state |
| Modify | `frontend/app/login/page.tsx` | Add "Register" link + `Link` import |

---

## Task 1: Register proxy route

**Files:**
- Create: `frontend/app/api/auth/register/route.ts`

- [ ] **Step 1: Create the file**

```ts
// frontend/app/api/auth/register/route.ts
import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ error: 'Cannot reach API' }, { status: 502 });
  }

  if (!res.ok) {
    if (res.status >= 500) {
      return NextResponse.json({ error: 'API error' }, { status: res.status });
    }
    let errorBody: unknown;
    try {
      errorBody = await res.json();
    } catch {
      const text = await res.text();
      errorBody = { error: text || 'Registration failed' };
    }
    return NextResponse.json(errorBody, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data, { status: 201 });
}
```

No cookie is set — registration does not log the user in; they must verify email first.

- [ ] **Step 2: Verify TypeScript compiles**

Run from `D:\staging\aeo-suite\frontend\`:
```
npx tsc --noEmit
```
Expected: no output (zero errors).

---

## Task 2: Register page

**Files:**
- Create: `frontend/app/register/page.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/app/register/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tenantName, setTenantName] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const slug = toSlug(tenantName);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (slug.length < 2) {
      setError('Company name must produce a valid slug (at least 2 alphanumeric characters).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          tenantName,
          tenantSlug: slug,
          billingEmail: email,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' })) as {
          error?: string;
          message?: string[] | string;
        };
        const msg = err.message
          ? Array.isArray(err.message) ? err.message.join(', ') : err.message
          : err.error ?? 'Registration failed';
        setError(msg);
        return;
      }

      setSuccess(true);
    } catch {
      setError('Could not reach server.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <p className="text-2xl mb-3">&#10003;</p>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Account created!</h2>
          <p className="text-sm text-slate-500">Check your email to verify before logging in.</p>
          <Link href="/login" className="mt-6 inline-block text-sm text-blue-600 hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Create account</h1>
        <p className="text-sm text-slate-500 mb-6">Start your AEO Suite trial</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              maxLength={72}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">At least 8 characters</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="tenantName" className="block text-sm font-medium text-slate-700 mb-1">
              Company Name
            </label>
            <input
              id="tenantName"
              type="text"
              required
              minLength={2}
              maxLength={100}
              value={tenantName}
              onChange={e => setTenantName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {slug.length >= 2 && (
              <p className="text-xs text-slate-400 mt-1">
                Slug: <span className="font-mono">{slug}</span>
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
```

Notes:
- `toSlug()` converts "Acme Corp" → `"acme-corp"`. Validated client-side (length >= 2) before submit.
- `billingEmail` is set to `email` silently — not shown in the UI.
- `loading ? 'Creating account…' : 'Create account'` — `…` is the ellipsis character, safe in `.tsx` string literals.
- `&#10003;` in the success state is the checkmark HTML entity, safe in JSX text content.

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```
Expected: no output.

---

## Task 3: Add "Register" link to login page

**Files:**
- Modify: `frontend/app/login/page.tsx`

The login page currently has no `Link` import and no register link. Two edits needed.

- [ ] **Step 1: Add `Link` import**

Find the existing import block (line 1-3):
```ts
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
```

Replace with:
```ts
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
```

- [ ] **Step 2: Add register link below the submit button**

Find the closing `</form>` tag (currently the last element inside the card `<div>`):
```tsx
        </form>
      </div>
    </div>
```

Replace with:
```tsx
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          Don&#39;t have an account?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">Register</Link>
        </p>
      </div>
    </div>
```

Note: `&#39;` is the apostrophe HTML entity, safe in JSX text content (avoids the `'` → `&apos;` lint warning).

- [ ] **Step 3: Verify TypeScript compiles**

```
npx tsc --noEmit
```
Expected: no output.

---

## Task 4: Build check + commit

- [ ] **Step 1: Run next build**

```
cd frontend && npx next build
```
Expected: build completes, routes list includes `/register` (static), zero type errors.

- [ ] **Step 2: Commit**

```bash
git add frontend/app/api/auth/register/route.ts \
        frontend/app/register/page.tsx \
        frontend/app/login/page.tsx
git commit -m "[TASK-005] fix: add missing register page and login link"
```

---

## Manual Smoke Test (after servers are up)

With backend running (`npm run start:dev`) and frontend (`npm run dev` in `frontend/`):

- [ ] Navigate to `http://localhost:3001/login` — confirm "Don't have an account? Register" link appears below the sign-in button.
- [ ] Click "Register" — confirm redirect to `/register`.
- [ ] Fill in all 4 fields and submit with mismatched passwords — confirm "Passwords do not match." error shown inline.
- [ ] Submit with Company Name that produces an invalid slug (e.g. all symbols) — confirm slug error shown.
- [ ] Submit valid data — confirm success state: "Account created! Check your email to verify before logging in."
- [ ] On success screen, click "Back to sign in" — confirm redirect to `/login`.
- [ ] On register page, click "Sign in" link — confirm redirect to `/login`.

---

## Notes

- The `/register` page has no sidebar (outside `[clientId]` layout) — same standalone card pattern as `/login`.
- `billingEmail` is not shown to the user — it is always set to the same value as `email`. This matches the typical SaaS pattern where the account email = billing email on signup.
- The proxy route at `/api/auth/register` does NOT set any cookies. The user must verify their email before logging in.
- Conflict errors (409) from the backend (`"Email already registered"`, `"Tenant slug already taken"`) are forwarded verbatim and rendered as inline form errors.
- The `tenantSlug` preview below the Company Name field gives users visibility into what slug will be registered, allowing them to adjust the company name if the slug is taken.
