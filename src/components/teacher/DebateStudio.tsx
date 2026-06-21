'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import SegmentCard, { type SegmentSide } from './SegmentCard';
import type { Motion } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

type SpeakerRole =
  | 'chairperson_open'
  | 'pro_1'
  | 'con_1'
  | 'pro_rebuttal'
  | 'con_rebuttal'
  | 'chairperson_close';

interface RawSegment {
  role: string;
  text: string;
}

interface DebateSegment {
  role:     SpeakerRole;
  label:    string;
  sublabel: string;
  side:     SegmentSide;
  text:     string;
}

interface GeneratedDebate {
  motionText:  string;
  segments:    DebateSegment[];
  generatedAt: string;
  postCount:   number;
  proCount:    number;
  conCount:    number;
  warning?:    string;
}

// ── Segment metadata ─────────────────────────────────────────────────────────

const SEGMENT_META: Record<SpeakerRole, { label: string; sublabel: string; side: SegmentSide }> = {
  chairperson_open:  { label: 'Chairperson',  sublabel: 'Opening',           side: 'chair' },
  pro_1:             { label: 'PRO',           sublabel: 'First PRO Speaker', side: 'pro'   },
  con_1:             { label: 'CON',           sublabel: 'First CON Speaker', side: 'con'   },
  pro_rebuttal:      { label: 'PRO',           sublabel: 'PRO Rebuttal',      side: 'pro'   },
  con_rebuttal:      { label: 'CON',           sublabel: 'CON Rebuttal',      side: 'con'   },
  chairperson_close: { label: 'Chairperson',  sublabel: 'Closing',           side: 'chair' },
};

const ROLE_ORDER: SpeakerRole[] = [
  'chairperson_open',
  'pro_1',
  'con_1',
  'pro_rebuttal',
  'con_rebuttal',
  'chairperson_close',
];

function enrichSegments(raw: RawSegment[]): DebateSegment[] {
  const result: DebateSegment[] = [];
  for (const role of ROLE_ORDER) {
    const found = raw.find(s => s.role === role);
    const meta = SEGMENT_META[role];
    result.push({
      role,
      label:    meta.label,
      sublabel: meta.sublabel,
      side:     meta.side,
      text:     found?.text ?? '(No content generated for this section.)',
    });
  }
  return result;
}

// ── Background shared with teacher pages ─────────────────────────────────────

const BG = { background: 'linear-gradient(135deg, #EEF2FF 0%, #F8F9FF 60%, #FFF7ED 100%)' };

// ── Component ─────────────────────────────────────────────────────────────────

export default function DebateStudio() {
  const params    = useParams();
  const sessionId = params.sessionId as string;

  const [sessionTopic,     setSessionTopic]     = useState('');
  const [motions,          setMotions]           = useState<Motion[]>([]);
  const [selectedMotionId, setSelectedMotionId]  = useState('');
  const [loadingMeta,      setLoadingMeta]       = useState(true);

  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState('');
  const [debate,     setDebate]     = useState<GeneratedDebate | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/sessions/${sessionId}`).then(r => r.json()),
      fetch(`/api/motions?session_id=${sessionId}`).then(r => r.json()),
    ])
      .then(([session, motionList]) => {
        setSessionTopic(session?.topic ?? '');
        if (Array.isArray(motionList) && motionList.length > 0) {
          setMotions(motionList);
          setSelectedMotionId(motionList[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMeta(false));
  }, [sessionId]);

  async function handleGenerate() {
    if (!selectedMotionId) return;
    setGenerating(true);
    setGenError('');
    setDebate(null);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/generate-debate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_MODERATOR_PASSWORD}`,
        },
        body: JSON.stringify({ motionId: selectedMotionId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setGenError(data.error ?? 'Generation failed. Please try again.');
        return;
      }

      setDebate({
        ...data,
        segments: enrichSegments(data.segments ?? []),
      });
    } catch {
      setGenError('Network error. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  const selectedMotion = motions.find(m => m.id === selectedMotionId);

  // ── Render ──

  if (loadingMeta) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={BG}>
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={BG}>
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Back link */}
        <Link
          href={`/teacher/${sessionId}`}
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-indigo-600 mb-7 transition-colors"
        >
          ← Back to session
        </Link>

        {/* Page heading */}
        <div className="mb-6">
          <p className="text-[10px] font-bold text-indigo-600 tracking-widest uppercase mb-1">
            Model Debate Studio
          </p>
          <h1 className="text-2xl font-bold text-slate-900 leading-snug mb-1">
            {sessionTopic || 'Debate Studio'}
          </h1>
          <p className="text-sm text-slate-500">
            AI generates a formal debate script from student contributions.
          </p>
        </div>

        {/* Motion selector — only shown when session has multiple motions */}
        {motions.length > 1 && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5">
            <p className="text-xs font-semibold text-slate-500 mb-2">Select motion</p>
            <div className="flex flex-col gap-2">
              {motions.map(m => (
                <label key={m.id} className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="motion"
                    value={m.id}
                    checked={selectedMotionId === m.id}
                    onChange={() => { setSelectedMotionId(m.id); setDebate(null); setGenError(''); }}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <span className="text-sm text-slate-700 leading-snug">{m.motion_text}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Selected motion display — single motion */}
        {motions.length === 1 && selectedMotion && (
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 mb-5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Motion</p>
            <p className="text-sm font-medium text-slate-800 leading-snug">{selectedMotion.motion_text}</p>
          </div>
        )}

        {/* No motions */}
        {motions.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
            <p className="text-sm text-amber-700">
              No motions found for this session. Add motions in the session settings before generating a debate.
            </p>
          </div>
        )}

        {/* Generate button */}
        {motions.length > 0 && (
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedMotionId}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl px-5 py-3 mb-5 transition-colors"
          >
            {generating ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Generating debate…
              </>
            ) : debate ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Regenerate debate
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
                Generate model debate
              </>
            )}
          </button>
        )}

        {/* Error */}
        {genError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 mb-5">
            <p className="text-sm text-rose-700">{genError}</p>
          </div>
        )}

        {/* Generated debate */}
        {debate && (
          <>
            {/* Metadata strip */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="text-xs text-slate-500">
                Based on{' '}
                <span className="font-semibold text-slate-700">{debate.postCount}</span>{' '}
                post{debate.postCount !== 1 ? 's' : ''}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-green-700 font-medium">{debate.proCount} PRO</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-red-700 font-medium">{debate.conCount} CON</span>
            </div>

            {/* Warning */}
            {debate.warning && (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p className="text-sm text-amber-700">{debate.warning}</p>
              </div>
            )}

            {/* Segment cards */}
            <div className="flex flex-col gap-4">
              {debate.segments.map((seg, i) => (
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
              Generated from student contributions · Not saved · Regenerate anytime
            </p>
          </>
        )}
      </div>
    </div>
  );
}
