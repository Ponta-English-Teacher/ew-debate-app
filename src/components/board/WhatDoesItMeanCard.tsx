'use client';

import { useState, useEffect } from 'react';
import type { Argument } from '@/types';

interface ExplanationResult {
  simpleExplanation: string;
  mainPoint:         string;
  keyPhrases:        string[];
}

interface Props {
  arg?:          Argument;
  parentContent?: string;
  motionText:    string;
  sessionId:     string;
}

export default function WhatDoesItMeanCard({ arg, parentContent, motionText, sessionId }: Props) {
  const [result,  setResult]  = useState<ExplanationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!arg) { setResult(null); setError(''); return; }
    setResult(null);
    setError('');
    setLoading(true);
    fetch('/api/ai/explain-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        postContent: arg.content,
        motionText,
        parentContent: parentContent ?? null,
        label: arg.response_type,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) setError('Could not load explanation.');
        else setResult(data as ExplanationResult);
      })
      .catch(() => setError('Could not load explanation.'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arg?.id, sessionId, motionText]);

  if (!arg) {
    return (
      <div className="py-0.5">
        <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
          What does it mean?
        </h3>
        <div className="flex gap-2">
          <span className="text-base shrink-0">💡</span>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Click the button on any post to see a simple explanation of its meaning.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-0.5">
      <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
        What does it mean?
      </h3>
      <p className="text-[10px] text-slate-400 italic leading-relaxed line-clamp-3 mb-2">
        &ldquo;{arg.content}&rdquo;
      </p>

      {loading && (
        <p className="text-[11px] text-slate-400 animate-pulse">Loading…</p>
      )}

      {error && !loading && (
        <p className="text-[11px] text-rose-500">{error}</p>
      )}

      {!loading && !error && result && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-slate-700 leading-relaxed">{result.simpleExplanation}</p>
          {result.mainPoint && (
            <div className="bg-slate-50 rounded px-2 py-1.5 border border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Main point</p>
              <p className="text-[11px] text-slate-600 leading-snug">{result.mainPoint}</p>
            </div>
          )}
          {result.keyPhrases.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {result.keyPhrases.map((phrase, i) => (
                <span key={i} className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">
                  {phrase}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
