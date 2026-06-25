'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import SegmentCard, { type SegmentSide } from './SegmentCard';
import type { Motion } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type SpeakerRole =
  | 'chairperson_open'
  | 'pro_1'
  | 'chair_transition_1'
  | 'con_1'
  | 'chair_transition_2'
  | 'pro_rebuttal'
  | 'chair_transition_3'
  | 'con_rebuttal'
  | 'chairperson_close';

// Older published debates were generated with only 6 segments and have
// no chair_transition_* entries — skip those silently rather than
// rendering an empty placeholder card for content that was never asked for.
const TRANSITION_ROLES = new Set<SpeakerRole>([
  'chair_transition_1',
  'chair_transition_2',
  'chair_transition_3',
]);

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

// Shape returned by the generate API
interface GeneratedDebate {
  motionText:  string;
  segments:    DebateSegment[];
  generatedAt: string;
  postCount:   number;
  proCount:    number;
  conCount:    number;
  warning?:    string;
}

// Shape stored in / loaded from Supabase
interface SavedDebate {
  id:         string;
  session_id: string;
  motion_id:  string;
  title:      string;
  segments:   Array<{ role: string; text: string; audioUrl: string | null }>;
  published:  boolean;
  created_at: string;
}

// ── Segment display metadata ──────────────────────────────────────────────────

const SEGMENT_META: Record<SpeakerRole, { label: string; sublabel: string; side: SegmentSide }> = {
  chairperson_open:    { label: 'Chairperson', sublabel: 'Opening',            side: 'chair' },
  pro_1:               { label: 'PRO',         sublabel: 'First PRO Speaker',  side: 'pro'   },
  chair_transition_1:  { label: 'Chairperson', sublabel: 'Transition',         side: 'chair' },
  con_1:               { label: 'CON',         sublabel: 'First CON Speaker',  side: 'con'   },
  chair_transition_2:  { label: 'Chairperson', sublabel: 'Transition',         side: 'chair' },
  pro_rebuttal:        { label: 'PRO',         sublabel: 'PRO Rebuttal',       side: 'pro'   },
  chair_transition_3:  { label: 'Chairperson', sublabel: 'Transition',         side: 'chair' },
  con_rebuttal:        { label: 'CON',         sublabel: 'CON Rebuttal',       side: 'con'   },
  chairperson_close:   { label: 'Chairperson', sublabel: 'Closing',            side: 'chair' },
};

const ROLE_ORDER: SpeakerRole[] = [
  'chairperson_open',
  'pro_1',
  'chair_transition_1',
  'con_1',
  'chair_transition_2',
  'pro_rebuttal',
  'chair_transition_3',
  'con_rebuttal',
  'chairperson_close',
];

function enrichSegments(raw: RawSegment[]): DebateSegment[] {
  return ROLE_ORDER
    .map(role => {
      const found = raw.find(s => s.role === role);
      // Older debates predate chairperson transitions — omit the card
      // entirely rather than showing an empty placeholder for them.
      if (!found && TRANSITION_ROLES.has(role)) return null;
      const meta = SEGMENT_META[role];
      return {
        role,
        label:    meta.label,
        sublabel: meta.sublabel,
        side:     meta.side,
        text:     found?.text ?? '(No content generated for this section.)',
      };
    })
    .filter((s): s is DebateSegment => s !== null);
}

function timeAgo(iso: string): string {
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60)    return 'just now';
  if (sec < 3600)  return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`;
  return `${Math.floor(sec / 86400)} days ago`;
}

const BG = { background: 'linear-gradient(135deg, #EEF2FF 0%, #F8F9FF 60%, #FFF7ED 100%)' };

const BEARER = `Bearer ${process.env.NEXT_PUBLIC_MODERATOR_PASSWORD}`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function DebateStudio() {
  const params    = useParams();
  const sessionId = params.sessionId as string;

  // Session / motion metadata
  const [sessionTopic,      setSessionTopic]      = useState('');
  const [motions,           setMotions]            = useState<Motion[]>([]);
  const [selectedMotionId,  setSelectedMotionId]   = useState('');
  const [loadingMeta,       setLoadingMeta]        = useState(true);

  // AI-generated debate (in memory, not saved yet)
  const [debate,      setDebate]     = useState<GeneratedDebate | null>(null);
  const [generating,  setGenerating] = useState(false);
  const [genError,    setGenError]   = useState('');

  // Saved debate (from Supabase)
  const [savedDebate,  setSavedDebate]  = useState<SavedDebate | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState('');

  // Load session + motions on mount
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

  // Load saved debate whenever selected motion changes
  useEffect(() => {
    if (!selectedMotionId) return;
    setLoadingSaved(true);
    setSavedDebate(null);

    fetch(`/api/sessions/${sessionId}/debates?motionId=${selectedMotionId}`, {
      headers: { 'Authorization': BEARER },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => setSavedDebate(data ?? null))
      .catch(() => setSavedDebate(null))
      .finally(() => setLoadingSaved(false));
  }, [sessionId, selectedMotionId]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!selectedMotionId) return;
    setGenerating(true);
    setGenError('');
    setDebate(null);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/generate-debate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': BEARER },
        body: JSON.stringify({ motionId: selectedMotionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setGenError(data.error ?? 'Generation failed. Please try again.'); return; }
      setDebate({ ...data, segments: enrichSegments(data.segments ?? []) });
    } catch {
      setGenError('Network error. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  // Publish: save + set published = true
  // Uses generated debate (debate) if available, otherwise saves the already-saved version as published
  async function handlePublish() {
    const source = debate ?? (savedDebate ? {
      motionText: '',
      segments: enrichSegments(savedDebate.segments),
    } as GeneratedDebate : null);

    if (!source || !selectedMotionId) return;
    setSaving(true);
    setSaveError('');

    const segments = source.segments.map(s => ({ role: s.role, text: s.text, audioUrl: null }));
    const motionText = (source as GeneratedDebate).motionText
      || motions.find(m => m.id === selectedMotionId)?.motion_text
      || '';
    const title = `Model Debate — ${motionText.slice(0, 60)}${motionText.length > 60 ? '…' : ''}`;

    try {
      const res = await fetch(`/api/sessions/${sessionId}/debates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': BEARER },
        body: JSON.stringify({ motionId: selectedMotionId, title, segments, published: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(data.error ?? 'Failed to publish.'); return; }
      setSavedDebate(data);
    } catch {
      setSaveError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUnpublish() {
    if (!savedDebate) return;
    setSaving(true);
    setSaveError('');

    try {
      const res = await fetch(`/api/debates/${savedDebate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': BEARER },
        body: JSON.stringify({ published: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(data.error ?? 'Failed to unpublish.'); return; }
      setSavedDebate(data);
    } catch {
      setSaveError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleMotionChange(motionId: string) {
    setSelectedMotionId(motionId);
    setDebate(null);
    setGenError('');
    setSaveError('');
  }

  // ── Derived display state ────────────────────────────────────────────────────

  const selectedMotion = motions.find(m => m.id === selectedMotionId);

  // Show freshly generated debate if available; fall back to saved version
  const displaySegments: DebateSegment[] | null = debate
    ? debate.segments
    : savedDebate
      ? enrichSegments(savedDebate.segments)
      : null;

  const displayMeta = debate ?? null; // metadata (counts, warning) only available from generator

  const isPublished  = savedDebate?.published ?? false;
  const hasSaved     = savedDebate !== null;
  const hasGenerated = debate !== null;

  // ── Render ───────────────────────────────────────────────────────────────────

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
            AI organises student contributions into a formal debate script.
          </p>
        </div>

        {/* Motion selector — only when multiple motions */}
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
                    onChange={() => handleMotionChange(m.id)}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <span className="text-sm text-slate-700 leading-snug">{m.motion_text}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Single-motion display */}
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
              No motions found. Add motions in session settings before generating a debate.
            </p>
          </div>
        )}

        {/* Generate button */}
        {motions.length > 0 && (
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedMotionId}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl px-5 py-3 mb-4 transition-colors"
          >
            {generating ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Generating debate…
              </>
            ) : (displaySegments || hasSaved) ? (
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

        {/* Generation error */}
        {genError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-rose-700">{genError}</p>
          </div>
        )}

        {/* Publication status bar */}
        {motions.length > 0 && (hasSaved || hasGenerated) && (
          <div className={`rounded-xl border px-4 py-3 mb-5 ${
            isPublished
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                {isPublished ? (
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">Published to students</p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      Visible at{' '}
                      <Link
                        href={`/board/${sessionId}/debate/${savedDebate!.motion_id}`}
                        target="_blank"
                        className="underline hover:text-emerald-800"
                      >
                        student debate view ↗
                      </Link>
                      {savedDebate && ` · ${timeAgo(savedDebate.created_at)}`}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-slate-600">
                      {hasSaved ? 'Saved — not visible to students' : 'Not saved yet'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Click "Publish to Students" to make this debate visible.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {isPublished ? (
                  <button
                    onClick={handleUnpublish}
                    disabled={saving}
                    className="text-xs font-semibold text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    {saving ? 'Updating…' : 'Unpublish'}
                  </button>
                ) : null}

                {/* Show "Publish to Students" when there's content to publish */}
                {(hasGenerated || (hasSaved && !isPublished)) && (
                  <button
                    onClick={handlePublish}
                    disabled={saving}
                    className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    {saving ? 'Publishing…' : isPublished && hasGenerated ? 'Publish new version' : 'Publish to Students'}
                  </button>
                )}
              </div>
            </div>

            {saveError && (
              <p className="text-xs text-rose-600 mt-2">{saveError}</p>
            )}
          </div>
        )}

        {/* Debate content */}
        {displaySegments && (
          <>
            {/* Metadata strip — only available from generator */}
            {displayMeta && (
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span className="text-xs text-slate-500">
                  Based on{' '}
                  <span className="font-semibold text-slate-700">{displayMeta.postCount}</span>{' '}
                  post{displayMeta.postCount !== 1 ? 's' : ''}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-green-700 font-medium">{displayMeta.proCount} PRO</span>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-red-700 font-medium">{displayMeta.conCount} CON</span>
              </div>
            )}

            {/* Loaded from saved — show saved indicator */}
            {!hasGenerated && hasSaved && !loadingSaved && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-slate-400">
                  Showing {isPublished ? 'published' : 'saved'} version
                  {savedDebate && ` · ${timeAgo(savedDebate.created_at)}`}
                </span>
              </div>
            )}

            {/* Warning if few contributions */}
            {displayMeta?.warning && (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p className="text-sm text-amber-700">{displayMeta.warning}</p>
              </div>
            )}

            {/* Segment cards */}
            <div className="flex flex-col gap-4">
              {displaySegments.map((seg, i) => (
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
              {hasGenerated
                ? 'Generated from student contributions · Not saved until published'
                : 'Loaded from saved version · Regenerate to create a new version'}
            </p>
          </>
        )}

        {/* Loading saved state */}
        {loadingSaved && !displaySegments && (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400">Loading saved debate…</p>
          </div>
        )}
      </div>
    </div>
  );
}
