'use client';

import { useState, useEffect } from 'react';

interface ReviewResult {
  good:            string;
  couldBeClearer:  string;
  improvedVersion: string;
}

interface Props {
  postContent:    string;
  motionText:     string;
  parentContent?: string | null;
  label?:         string;
  onClose:        () => void;
}

export default function ReviewImproveModal({ postContent, motionText, parentContent, label, onClose }: Props) {
  const [result,  setResult]  = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [copied,  setCopied]  = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch('/api/ai/review-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postContent, motionText, parentContent: parentContent ?? null, label }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.error) setError('Could not load review. Please try again.');
        else setResult(data as ReviewResult);
      })
      .catch(() => { if (!cancelled) setError('Could not load review. Please try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.improvedVersion);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — nothing useful to do
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Review &amp; Improve</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm leading-none">✕</button>
        </div>

        <p className="text-[11px] text-slate-500 italic leading-relaxed line-clamp-3 mb-3 bg-slate-50 rounded px-2 py-1.5 border border-slate-100">
          &ldquo;{postContent}&rdquo;
        </p>

        {loading && <p className="text-[12px] text-slate-400 animate-pulse">Reviewing your argument…</p>}
        {error && !loading && <p className="text-[12px] text-rose-500">{error}</p>}

        {!loading && !error && result && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1">What&apos;s good</p>
              <p className="text-[12px] text-slate-700 leading-relaxed">{result.good}</p>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1">Could be clearer</p>
              <p className="text-[12px] text-slate-700 leading-relaxed">{result.couldBeClearer}</p>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded px-3 py-2">
              <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide mb-1">Stronger version</p>
              <p className="text-[13px] text-slate-800 leading-relaxed">{result.improvedVersion}</p>
              <button
                onClick={handleCopy}
                className="mt-2 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                {copied ? 'Copied' : 'Copy improved version'}
              </button>
            </div>

            <p className="text-[10px] text-slate-400 leading-snug">
              This does not change your post. Copy the text above if you want to edit your post yourself.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
