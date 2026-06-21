'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SegmentCard, { type SegmentSide } from '@/components/teacher/SegmentCard';

// ── Types ─────────────────────────────────────────────────────────────────────

type SpeakerRole =
  | 'chairperson_open'
  | 'pro_1'
  | 'con_1'
  | 'pro_rebuttal'
  | 'con_rebuttal'
  | 'chairperson_close';

interface RawSegment {
  role:     string;
  text:     string;
  audioUrl: string | null;
}

interface DisplaySegment {
  role:     SpeakerRole;
  label:    string;
  sublabel: string;
  side:     SegmentSide;
  text:     string;
}

interface SavedDebate {
  id:         string;
  session_id: string;
  motion_id:  string;
  title:      string;
  segments:   RawSegment[];
  published:  boolean;
  created_at: string;
}

// ── Segment display metadata ──────────────────────────────────────────────────

const SEGMENT_META: Record<SpeakerRole, { label: string; sublabel: string; side: SegmentSide }> = {
  chairperson_open:  { label: 'Chairperson', sublabel: 'Opening',           side: 'chair' },
  pro_1:             { label: 'PRO',          sublabel: 'First PRO Speaker', side: 'pro'   },
  con_1:             { label: 'CON',          sublabel: 'First CON Speaker', side: 'con'   },
  pro_rebuttal:      { label: 'PRO',          sublabel: 'PRO Rebuttal',      side: 'pro'   },
  con_rebuttal:      { label: 'CON',          sublabel: 'CON Rebuttal',      side: 'con'   },
  chairperson_close: { label: 'Chairperson', sublabel: 'Closing',           side: 'chair' },
};

const ROLE_ORDER: SpeakerRole[] = [
  'chairperson_open',
  'pro_1',
  'con_1',
  'pro_rebuttal',
  'con_rebuttal',
  'chairperson_close',
];

function enrichSegments(raw: RawSegment[]): DisplaySegment[] {
  return ROLE_ORDER.map(role => {
    const found = raw.find(s => s.role === role);
    const meta  = SEGMENT_META[role];
    return {
      role,
      label:    meta.label,
      sublabel: meta.sublabel,
      side:     meta.side,
      text:     found?.text ?? '(No content for this section.)',
    };
  });
}

function timeAgo(iso: string): string {
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60)    return 'just now';
  if (sec < 3600)  return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`;
  return `${Math.floor(sec / 86400)} days ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  sessionId: string;
  motionId:  string;
}

export default function DebateView({ sessionId, motionId }: Props) {
  const [debate,   setDebate]   = useState<SavedDebate | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/debates?motionId=${motionId}`)
      .then(r => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then(data => { if (data) setDebate(data); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [sessionId, motionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  if (notFound || !debate) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 px-4">
        <p className="text-sm text-slate-500 text-center">
          No published debate found for this motion.
        </p>
        <Link href={`/board/${sessionId}`} className="text-sm text-indigo-600 hover:underline">
          ← Back to discussion
        </Link>
      </div>
    );
  }

  const segments = enrichSegments(debate.segments);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-6 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-indigo-600 tracking-widest uppercase mb-0.5">
              Model Debate
            </p>
            <p className="text-sm font-semibold text-slate-800 leading-snug truncate">
              {debate.title || 'Model Debate'}
            </p>
          </div>
          <Link
            href={`/board/${sessionId}`}
            className="shrink-0 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors whitespace-nowrap"
          >
            ← Back to discussion
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Notice */}
        <div className="flex items-start gap-2.5 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-6">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-xs text-indigo-700 leading-relaxed">
            This model debate was generated from your class's contributions.
            The arguments are based on what you and your classmates posted in the discussion.
          </p>
        </div>

        {/* Segment cards */}
        <div className="flex flex-col gap-4">
          {segments.map((seg, i) => (
            <SegmentCard
              key={seg.role}
              index={i + 1}
              label={seg.label}
              sublabel={seg.sublabel}
              side={seg.side}
              text={seg.text}
            />
          ))}
        </div>

        <p className="text-[11px] text-slate-400 text-center mt-6">
          Generated from class contributions · Published {timeAgo(debate.created_at)}
        </p>
      </div>
    </div>
  );
}
