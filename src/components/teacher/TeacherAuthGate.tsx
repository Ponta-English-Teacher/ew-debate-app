'use client';

import { useState, useEffect } from 'react';

export default function TeacherAuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Ask the server whether the HTTP-only teacher cookie is valid
  useEffect(() => {
    fetch('/api/teacher/me', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => setAuthed(data?.authed === true))
      .catch(() => setAuthed(false))
      .finally(() => setReady(true));
  }, []);

  // If the login expires mid-session, any 401 from the API returns to the password screen
  useEffect(() => {
    if (!authed) return;
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await originalFetch(...args);
      const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url;
      if (res.status === 401 && new URL(url, window.location.href).pathname.startsWith('/api/')) {
        setAuthed(false);
      }
      return res;
    };
    return () => { window.fetch = originalFetch; };
  }, [authed]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/teacher/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        setAuthed(true);
        setError(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(res.status === 401 ? 'Incorrect password. Please try again.' : (data.error ?? 'Login failed. Please try again.'));
        setError(true);
      }
    } catch {
      setErrorMessage('Network error. Please try again.');
      setError(true);
    } finally {
      setPw('');
      setSubmitting(false);
    }
  }

  // Avoid flash of password screen before the server responds
  if (!ready) return null;

  if (authed) return <>{children}</>;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #F8F9FF 60%, #FFF7ED 100%)' }}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">Teacher Panel</h1>
            <p className="text-xs text-slate-400">EW Debate — Moderator access only</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={pw}
            onChange={e => { setPw(e.target.value); setError(false); }}
            placeholder="Moderator password"
            autoFocus
            className={`w-full border rounded-lg px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 transition-colors ${
              error
                ? 'border-rose-400 focus:ring-rose-300'
                : 'border-slate-200 focus:ring-indigo-400'
            }`}
          />
          {error && (
            <p className="text-xs text-rose-500">{errorMessage}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
          >
            {submitting ? '…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
