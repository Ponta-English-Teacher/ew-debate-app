'use client';

import { useState } from 'react';
import type { Argument, ResponseType } from '@/types';
import { i18n } from '@/lib/i18n';

interface Props {
  sessionId: string;
  motionId: string;
  studentId: string;
  mode: 'claim' | 'response';
  parentId?: string | null;
  parentArgument?: Pick<Argument, 'id' | 'content' | 'response_type'> | null;
  onSubmitted: (arg: Argument) => void;
  onCancel: () => void;
}

export default function ArgumentForm({
  sessionId,
  motionId,
  studentId,
  mode,
  parentId,
  parentArgument,
  onSubmitted,
  onCancel,
}: Props) {
  const t = i18n.board;

  // Response type is set to 'claim' for claims; for responses it defaults to 'support'
  // until AI inference (Step 16) assigns it based on the dialogue.
  const [responseType, setResponseType] = useState<ResponseType>(
    mode === 'claim' ? 'claim' : 'support'
  );
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!content.trim()) {
      setError('Please write your argument.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/arguments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          motion_id: motionId,
          parent_id: parentId ?? null,
          student_id: studentId,
          response_type: responseType,
          content: content.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? i18n.common.error);
        return;
      }

      const arg: Argument = await res.json();
      setContent('');
      setResponseType(mode === 'claim' ? 'claim' : 'support');
      onSubmitted(arg);
    } catch {
      setError(i18n.common.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"
    >
      {/* Parent excerpt — label and content only, no type badge */}
      {parentArgument && (
        <div className="mb-4 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
            {t.respondingTo}
          </p>
          <p className="text-xs text-slate-600 leading-snug line-clamp-2">
            {parentArgument.content}
          </p>
        </div>
      )}

      {/* Content textarea */}
      <div className="mb-4">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={t.contentPlaceholder}
          rows={4}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition leading-relaxed"
        />
        <p className="text-[11px] text-slate-400 text-right mt-1">
          {content.trim().split(/\s+/).filter(Boolean).length} words
        </p>
      </div>

      {error && <p className="text-xs text-rose-600 mb-3">{error}</p>}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg transition-colors"
        >
          {t.cancel}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 transition-colors"
        >
          {submitting ? t.submitting : t.submit}
        </button>
      </div>
    </form>
  );
}
