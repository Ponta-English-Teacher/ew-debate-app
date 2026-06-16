'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Session, Motion } from '@/types';
import { i18n } from '@/lib/i18n';

export default function SessionDetail() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const t = i18n.teacher;

  const [session, setSession] = useState<Session | null>(null);
  const [motions, setMotions] = useState<Motion[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [newMotion, setNewMotion] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    Promise.all([
      fetch(`/api/sessions/${sessionId}`).then(async r => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      }),
      fetch(`/api/motions?session_id=${sessionId}`).then(r => r.json()),
    ])
      .then(([s, m]) => {
        if (s) setSession(s as Session);
        if (Array.isArray(m)) setMotions(m as Motion[]);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  async function toggleActive() {
    if (!session) return;
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !session.is_active }),
    });
    if (res.ok) {
      const updated: Session = await res.json();
      setSession(prev => prev ? { ...prev, is_active: updated.is_active } : prev);
    }
  }

  async function copyCode() {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.class_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  async function handleAddMotion(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    const text = newMotion.trim();
    if (!text) return;

    setAdding(true);
    try {
      const res = await fetch('/api/motions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          motion_text: text,
          sort_order: motions.length,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAddError(data.error ?? i18n.common.error);
        return;
      }
      const motion: Motion = await res.json();
      setMotions(prev => [...prev, motion]);
      setNewMotion('');
    } catch {
      setAddError(i18n.common.error);
    } finally {
      setAdding(false);
    }
  }

  async function deleteMotion(id: string) {
    const res = await fetch(`/api/motions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMotions(prev => prev.filter(m => m.id !== id));
      setConfirmDelete(null);
    }
  }

  const bg = { background: 'linear-gradient(135deg, #EEF2FF 0%, #F8F9FF 60%, #FFF7ED 100%)' };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={bg}>
        <p className="text-sm text-slate-400">{i18n.common.loading}</p>
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={bg}>
        <p className="text-sm text-slate-500">{i18n.common.sessionNotFound}</p>
        <Link href="/teacher" className="text-sm text-indigo-600 hover:underline">
          {t.backToSessions}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={bg}>
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Back link */}
        <Link
          href="/teacher"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-indigo-600 mb-7 transition-colors"
        >
          {t.backToSessions}
        </Link>

        {/* Session header */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h1 className="text-lg font-bold text-slate-800 leading-snug">{session.topic}</h1>
            <span className={`shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
              session.is_active
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {session.is_active ? t.active : t.inactive}
            </span>
          </div>

          <div className="flex items-center gap-2 mb-5">
            <span className="text-xs text-slate-500">{t.classCode}</span>
            <span className="font-mono font-bold text-indigo-600 tracking-widest text-base">
              {session.class_code}
            </span>
            <button
              onClick={copyCode}
              className="text-xs text-slate-400 hover:text-indigo-600 border border-slate-200 rounded px-2 py-0.5 transition-colors"
            >
              {copied ? t.linkCopied : t.copyLink}
            </button>
          </div>

          <button
            onClick={toggleActive}
            className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            {session.is_active ? t.deactivate : t.activate}
          </button>
        </div>

        {/* Motions */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
            {t.motions} ({motions.length}/3)
          </h2>

          {motions.length === 0 ? (
            <p className="text-sm text-slate-400 mb-5">No motions yet. Add one below.</p>
          ) : (
            <div className="space-y-2 mb-5">
              {motions.map((motion, idx) => (
                <div
                  key={motion.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="flex-1 text-sm text-slate-700 leading-snug">{motion.motion_text}</p>
                  <div className="shrink-0 flex items-center gap-1">
                    {confirmDelete === motion.id ? (
                      <>
                        <button
                          onClick={() => deleteMotion(motion.id)}
                          className="text-xs font-medium text-white bg-rose-500 hover:bg-rose-600 rounded px-2 py-0.5 transition-colors"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs text-slate-400 hover:text-slate-600 rounded px-2 py-0.5 transition-colors"
                        >
                          No
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(motion.id)}
                        className="text-xs text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        {t.removeMotion}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {motions.length < 3 ? (
            <form onSubmit={handleAddMotion} className="flex gap-2">
              <input
                type="text"
                value={newMotion}
                onChange={e => setNewMotion(e.target.value)}
                placeholder={t.motionPlaceholder}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
              />
              <button
                type="submit"
                disabled={adding || !newMotion.trim()}
                className="shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg px-3 py-2 transition-colors"
              >
                {adding ? '…' : t.addMotion}
              </button>
            </form>
          ) : (
            <p className="text-xs text-slate-400">Maximum 3 motions reached.</p>
          )}

          {addError && <p className="text-xs text-rose-600 mt-2">{addError}</p>}
        </div>
      </div>
    </div>
  );
}
