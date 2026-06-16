'use client';

import { useState } from 'react';
import type { Session } from '@/types';
import { i18n } from '@/lib/i18n';

interface Props {
  onCreated: (session: Session & { motion_count: number }) => void;
}

export default function CreateSessionForm({ onCreated }: Props) {
  const t = i18n.teacher;
  const [topic, setTopic] = useState('');
  const [motions, setMotions] = useState(['', '']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function addMotion() {
    if (motions.length < 3) setMotions([...motions, '']);
  }

  function removeMotion(idx: number) {
    setMotions(motions.filter((_, i) => i !== idx));
  }

  function updateMotion(idx: number, value: string) {
    setMotions(motions.map((m, i) => (i === idx ? value : m)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmedTopic = topic.trim();
    const validMotions = motions.map(m => m.trim()).filter(Boolean);

    if (!trimmedTopic) { setError('Topic is required.'); return; }
    if (!validMotions.length) { setError(t.atLeastOneMotion); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: trimmedTopic, motions: validMotions }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? i18n.common.error);
        return;
      }
      const session: Session = await res.json();
      setTopic('');
      setMotions(['', '']);
      onCreated({ ...session, motion_count: validMotions.length });
    } catch {
      setError(i18n.common.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h2 className="text-base font-semibold text-slate-800 mb-5">{t.newSession}</h2>

      {/* Topic */}
      <div className="mb-5">
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          {t.topicLabel}
        </label>
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder={t.topicPlaceholder}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
        />
      </div>

      {/* Motions */}
      <div className="space-y-3 mb-3">
        {motions.map((motion, idx) => (
          <div key={idx}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-600">
                {t.motionLabel} {idx + 1}
              </label>
              {motions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMotion(idx)}
                  className="text-xs text-slate-400 hover:text-rose-500 transition-colors"
                >
                  {t.removeMotion}
                </button>
              )}
            </div>
            <input
              type="text"
              value={motion}
              onChange={e => updateMotion(idx, e.target.value)}
              placeholder={t.motionPlaceholder}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            />
          </div>
        ))}
      </div>

      {motions.length < 3 && (
        <button
          type="button"
          onClick={addMotion}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 mb-5 transition-colors"
        >
          {t.addMotion}
        </button>
      )}

      {error && (
        <p className="text-xs text-rose-600 mb-4 mt-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors mt-2"
      >
        {submitting ? t.creating : t.createSession}
      </button>
    </form>
  );
}
