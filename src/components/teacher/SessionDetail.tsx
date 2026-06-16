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

  // Reset discussion state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPhrase, setResetPhrase] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

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

  function openResetModal() {
    setResetPhrase('');
    setResetError('');
    setResetSuccess(false);
    setShowResetModal(true);
  }

  function closeResetModal() {
    if (resetting) return;
    setShowResetModal(false);
    setResetPhrase('');
    setResetError('');
  }

  async function handleReset() {
    if (resetPhrase !== 'RESET' || !session) return;
    setResetting(true);
    setResetError('');
    try {
      const res = await fetch(`/api/sessions/${session.id}/reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_MODERATOR_PASSWORD}`,
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setResetError(data.error ?? 'Reset failed. Please try again.');
        return;
      }
      setResetSuccess(true);
      setShowResetModal(false);
      setResetPhrase('');
    } catch {
      setResetError('Network error. Please try again.');
    } finally {
      setResetting(false);
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

        {/* Danger Zone */}
        <div className="mt-8 border border-rose-200 rounded-2xl p-6">
          <h2 className="text-xs font-semibold text-rose-600 uppercase tracking-widest mb-1">
            Danger Zone
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            These actions affect student discussion data and cannot be undone.
          </p>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-0.5">Reset discussion data</p>
              <p className="text-xs text-slate-500">
                Permanently deletes all posts, replies, and votes for this session.
                The session, motions, and student names are kept.
              </p>
            </div>
            <button
              onClick={openResetModal}
              className="shrink-0 text-xs font-semibold text-rose-600 border border-rose-300 hover:bg-rose-50 rounded-lg px-4 py-2 transition-colors"
            >
              Reset discussion data
            </button>
          </div>

          {resetSuccess && (
            <p className="text-xs text-emerald-600 mt-4 font-medium">
              Discussion data has been reset. The board is now empty.
            </p>
          )}
        </div>
      </div>

      {/* Reset confirmation modal */}
      {showResetModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
          onClick={e => { if (e.target === e.currentTarget) closeResetModal(); }}
        >
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            {/* Warning header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h2 className="text-base font-bold text-slate-800">Reset discussion data?</h2>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              This will permanently delete all posts, replies, and votes for this session.{' '}
              <span className="font-semibold text-slate-800">This cannot be undone.</span>
            </p>

            <p className="text-xs text-slate-500 mb-2">
              Type <span className="font-mono font-bold text-slate-800">RESET</span> to confirm:
            </p>
            <input
              type="text"
              value={resetPhrase}
              onChange={e => { setResetPhrase(e.target.value); setResetError(''); }}
              placeholder="RESET"
              autoFocus
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 font-mono outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition mb-3"
            />

            {resetError && (
              <p className="text-xs text-rose-600 mb-3">{resetError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={closeResetModal}
                disabled={resetting}
                className="flex-1 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg px-4 py-2.5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetPhrase !== 'RESET' || resetting}
                className="flex-1 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-4 py-2.5 transition-colors"
              >
                {resetting ? 'Deleting…' : 'Delete all data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
