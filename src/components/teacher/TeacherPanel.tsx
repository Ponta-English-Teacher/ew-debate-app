'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Session } from '@/types';
import { i18n } from '@/lib/i18n';
import CreateSessionForm from './CreateSessionForm';

export default function TeacherPanel() {
  const t = i18n.teacher;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSessions(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleCreated(session: Session & { motion_count: number }) {
    setSessions(prev => [session, ...prev]);
  }

  async function toggleActive(session: Session) {
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !session.is_active }),
    });
    if (res.ok) {
      const updated: Session = await res.json();
      setSessions(prev =>
        prev.map(s => s.id === updated.id ? { ...updated, motion_count: s.motion_count } : s)
      );
    }
  }

  async function deleteSession(id: string) {
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSessions(prev => prev.filter(s => s.id !== id));
      setConfirmDelete(null);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #F8F9FF 60%, #FFF7ED 100%)' }}>
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">{t.title}</h1>
            <p className="text-xs text-slate-500">EW Debate App</p>
          </div>
        </div>

        {/* Create session form */}
        <div className="mb-10">
          <CreateSessionForm onCreated={handleCreated} />
        </div>

        {/* Sessions list */}
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
            {t.sessions}{sessions.length > 0 ? ` (${sessions.length})` : ''}
          </h2>

          {loading ? (
            <p className="text-sm text-slate-400">{i18n.common.loading}</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-slate-400">{t.noSessions}</p>
          ) : (
            <div className="space-y-3">
              {sessions.map(session => (
                <div
                  key={session.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"
                >
                  {/* Topic + active badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="font-semibold text-slate-800 text-sm leading-snug">
                      {session.topic}
                    </h3>
                    <span className={`shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      session.is_active
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {session.is_active ? t.active : t.inactive}
                    </span>
                  </div>

                  {/* Class code */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-slate-500">{t.classCode}</span>
                    <span className="font-mono font-bold text-indigo-600 tracking-widest text-sm">
                      {session.class_code}
                    </span>
                    <button
                      onClick={() => copyCode(session.class_code)}
                      className="text-xs text-slate-400 hover:text-indigo-600 border border-slate-200 rounded px-2 py-0.5 transition-colors"
                    >
                      {copied === session.class_code ? t.linkCopied : t.copyLink}
                    </button>
                  </div>

                  {/* Motion count */}
                  <p className="text-xs text-slate-400 mb-4">
                    {session.motion_count ?? 0} {t.motions}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/teacher/${session.id}`}
                      className="text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      {t.manageSession}
                    </Link>
                    <button
                      onClick={() => toggleActive(session)}
                      className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      {session.is_active ? t.deactivate : t.activate}
                    </button>

                    {confirmDelete === session.id ? (
                      <>
                        <button
                          onClick={() => deleteSession(session.id)}
                          className="text-xs font-medium text-white bg-rose-500 hover:bg-rose-600 rounded-lg px-3 py-1.5 transition-colors"
                        >
                          {t.confirmDelete}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs font-medium text-slate-500 hover:text-slate-700 rounded-lg px-3 py-1.5 transition-colors"
                        >
                          {t.cancelDelete}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(session.id)}
                        className="text-xs font-medium text-slate-400 hover:text-rose-500 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        {t.deleteSession}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
