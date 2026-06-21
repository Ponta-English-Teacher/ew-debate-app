'use client';

import { useState, useEffect, useRef } from 'react';

export type SegmentSide = 'chair' | 'pro' | 'con';

interface Props {
  label:      string;
  sublabel?:  string;
  side:       SegmentSide;
  text:       string;
  index:      number;
}

const SIDE_STYLE: Record<SegmentSide, { badge: string; leftColor: string; indexColor: string }> = {
  chair: {
    badge:      'text-indigo-700 bg-indigo-50 border-indigo-200',
    leftColor:  '#6366F1',
    indexColor: '#6366F1',
  },
  pro: {
    badge:      'text-green-700 bg-green-50 border-green-200',
    leftColor:  '#16A34A',
    indexColor: '#16A34A',
  },
  con: {
    badge:      'text-red-700 bg-red-50 border-red-200',
    leftColor:  '#DC2626',
    indexColor: '#DC2626',
  },
};

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

export default function SegmentCard({ label, sublabel, side, text, index }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const s = SIDE_STYLE[side];

  function handlePlay() {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.onend   = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
  }

  useEffect(() => {
    return () => {
      if (utteranceRef.current) window.speechSynthesis.cancel();
    };
  }, []);

  return (
    <div
      className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: s.leftColor }}
    >
      <div className="px-5 py-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white"
              style={{ backgroundColor: s.leftColor }}
            >
              {index}
            </span>
            <div className="min-w-0">
              <span
                className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded border tracking-wide uppercase ${s.badge}`}
              >
                {label}
              </span>
              {sublabel && (
                <p className="text-[10px] text-slate-400 mt-0.5">{sublabel}</p>
              )}
            </div>
          </div>

          <button
            onClick={handlePlay}
            className={`shrink-0 flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 transition-colors ${
              isPlaying
                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {isPlaying ? <StopIcon /> : <PlayIcon />}
            {isPlaying ? 'Stop' : 'Play'}
          </button>
        </div>

        {/* Speech text */}
        <p className="text-[16px] text-slate-800 leading-[1.65] whitespace-pre-wrap">
          {text}
        </p>
      </div>
    </div>
  );
}
