'use client';

import { useState, useEffect } from 'react';
import { isTeacherAuthed, setTeacherAuthed } from '@/lib/teacherAuth';

export default function TeacherAuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    setAuthed(isTeacherAuthed());
    setReady(true);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const expected = process.env.NEXT_PUBLIC_MODERATOR_PASSWORD;
    if (expected && pw === expected) {
      setTeacherAuthed();
      setAuthed(true);
      setError(false);
    } else {
      setError(true);
      setPw('');
    }
  }

  // Avoid flash of password screen before sessionStorage is read
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
            <p className="text-xs text-rose-500">Incorrect password. Please try again.</p>
          )}
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
