'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import type { Motion, Argument, ReactionType } from '@/types';
import { type SessionSettings, DEFAULT_SETTINGS } from '@/lib/sessionSettings';
import { getLabel, LABEL_STYLE, type DebateLabel } from '@/lib/debateLabels';
import ArgumentCluster from './ArgumentCluster';
import AIDiscussionModal from './AIDiscussionModal';
import WhatDoesItMeanCard from './WhatDoesItMeanCard';

// ── Types (exported — used by page.tsx and ArgumentCluster) ──────────────────

export type FormState =
  | { kind: 'closed' }
  | { kind: 'claim'; motionId: string }
  | { kind: 'response'; motionId: string; parent: Argument }
  | { kind: 'modal-claim'; motionId: string }
  | { kind: 'modal-response'; motionId: string; parent: Argument };

export interface Cluster {
  claim: Argument;
  responses: Argument[];
}

// ── Thread chain builder — walk ancestors for discuss reply context ───────────

function buildThreadChain(parentArg: Argument, argList: Argument[]): string[] {
  const chain: string[] = [];
  let currentId: string | null = parentArg.id;
  let limit = 4; // cap at 4 levels to avoid overly long prompts
  while (currentId && limit-- > 0) {
    const arg = argList.find(a => a.id === currentId);
    if (!arg) break;
    chain.unshift(arg.content); // oldest first
    currentId = arg.parent_id;
  }
  return chain;
}

// ── Cluster builder ───────────────────────────────────────────────────────────

function buildClusters(args: Argument[], motionId: string): Cluster[] {
  const motionArgs = args.filter(a => a.motion_id === motionId);
  const claims = motionArgs.filter(a => a.parent_id === null);

  const childrenMap = new Map<string, Argument[]>();
  motionArgs
    .filter(a => a.parent_id !== null)
    .forEach(a => {
      const pid = a.parent_id!;
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(a);
    });

  function collectDescendants(nodeId: string): Argument[] {
    const children = childrenMap.get(nodeId) ?? [];
    const result: Argument[] = [];
    for (const child of children) {
      result.push(child);
      result.push(...collectDescendants(child.id));
    }
    return result;
  }

  return claims.map(claim => ({
    claim,
    responses: collectDescendants(claim.id),
  }));
}

// ── Sidebar cards ─────────────────────────────────────────────────────────────

function HowToParticipateCard() {
  const steps = [
    { icon: '✏️', title: 'Share your opinion', desc: 'Support, oppose, ask questions, or add clarifications.' },
    { icon: '💬', title: 'Respect others', desc: 'Listen carefully and respond politely.' },
    { icon: '👍', title: 'Build the discussion', desc: 'Reply to others and develop your ideas together.' },
  ];
  return (
    <div className="py-0.5">
      <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">How to participate</h3>
      <div className="flex flex-col gap-2">
        {steps.map(({ icon, title, desc }) => (
          <div key={title} className="flex gap-2">
            <span className="text-xs shrink-0">{icon}</span>
            <div>
              <p className="text-[11px] font-semibold text-slate-600">{title}</p>
              <p className="text-[11px] text-slate-400 leading-snug">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const LEGEND_ITEMS: Array<{ label: DebateLabel; desc: string }> = [
  { label: 'PRO',      desc: 'Supports the motion' },
  { label: 'CON',      desc: 'Opposes the motion' },
  { label: 'QUESTION', desc: 'Asks a question' },
  { label: 'OTHER',    desc: 'Clarification, example, or other contribution' },
];

function LegendCard() {
  return (
    <div className="py-0.5">
      <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Legend (labels)</h3>
      <div className="flex flex-col gap-1.5">
        {LEGEND_ITEMS.map(({ label, desc }) => {
          const s = LABEL_STYLE[label];
          return (
            <div key={label} className="flex items-start gap-2">
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 mt-0.5"
                style={{ color: s.text, backgroundColor: s.bg, borderColor: s.border }}
              >
                {label}
              </span>
              <p className="text-[11px] text-slate-500 leading-snug">{desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'pro' | 'con' | 'question' | 'other';

const FILTER_COLOR: Record<FilterKey, string> = {
  all:      '#6366F1',
  pro:      '#16A34A',
  con:      '#DC2626',
  question: '#D97706',
  other:    '#64748B',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  sessionId: string;
  studentId: string;
  motions: Motion[];
  argList: Argument[];
  form: FormState;
  onFormChange: (state: FormState) => void;
  onSubmitted: (arg: Argument) => void;
  onReactionChange: (argumentId: string, reactionType: ReactionType, active: boolean) => void;
  onDeleted?: (argumentId: string) => void;
  features?: SessionSettings;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MotionRiver({
  sessionId,
  studentId,
  motions,
  argList,
  form,
  onFormChange,
  onSubmitted,
  onReactionChange,
  onDeleted,
  features = DEFAULT_SETTINGS,
}: Props) {
  const [selectedMotionId,   setSelectedMotionId]   = useState(motions[0]?.id ?? '');
  const [filter,             setFilter]             = useState<FilterKey>('all');
  const [explainId,          setExplainId]          = useState<string | null>(null);
  const [hasPublishedDebate, setHasPublishedDebate] = useState(false);

  // Check whether a published debate exists for the selected motion
  useEffect(() => {
    if (!selectedMotionId) return;
    setHasPublishedDebate(false);
    fetch(`/api/sessions/${sessionId}/debates?motionId=${selectedMotionId}`)
      .then(r => setHasPublishedDebate(r.ok))
      .catch(() => setHasPublishedDebate(false));
  }, [sessionId, selectedMotionId]);

  const selectedMotion = useMemo(
    () => motions.find(m => m.id === selectedMotionId) ?? motions[0],
    [motions, selectedMotionId],
  );

  const clusters = useMemo(
    () => buildClusters(argList, selectedMotion?.id ?? ''),
    [argList, selectedMotion?.id],
  );

  // Count by label across ALL args for the motion (not just top-level)
  const counts = useMemo(() => {
    const motionArgs = argList.filter(a => a.motion_id === selectedMotion?.id);
    const c = { all: motionArgs.length, pro: 0, con: 0, question: 0, other: 0 };
    motionArgs.forEach(a => {
      const l = getLabel(a.response_type).toLowerCase() as Exclude<FilterKey, 'all'>;
      c[l]++;
    });
    return c;
  }, [argList, selectedMotion?.id]);

  const filteredClusters = useMemo(() => {
    if (filter === 'all') return clusters;
    return clusters.filter(({ claim }) => getLabel(claim.response_type).toLowerCase() === filter);
  }, [clusters, filter]);

  const participantCount = useMemo(
    () => new Set(argList.filter(a => a.motion_id === selectedMotion?.id).map(a => a.student_id)).size,
    [argList, selectedMotion?.id],
  );

  const explainArg    = explainId ? argList.find(a => a.id === explainId) : undefined;
  const explainParent = explainArg?.parent_id ? argList.find(a => a.id === explainArg.parent_id) : undefined;

  const isModalOpen =
    (form.kind === 'modal-claim' || form.kind === 'modal-response') &&
    !!selectedMotion && form.motionId === selectedMotion.id;

  if (!selectedMotion) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-slate-400">No motions yet. Ask your teacher to add motions.</p>
      </div>
    );
  }

  const filters: Array<{ key: FilterKey; label: string }> = [
    { key: 'all',      label: 'All Posts' },
    { key: 'pro',      label: 'Pro' },
    { key: 'con',      label: 'Con' },
    { key: 'question', label: 'Questions' },
    { key: 'other',    label: 'Other' },
  ];

  return (
    <div className="min-h-full">

      {/* ── Motion header ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-8">
        <p className="text-[10px] font-bold text-indigo-600 tracking-widest uppercase mb-2">Motion</p>
        <div className="flex items-start justify-between gap-8 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-[1.75rem] font-bold text-slate-900 leading-tight mb-2">
              {selectedMotion.motion_text}
            </h1>
            <p className="text-sm text-slate-500">
              Read other students' opinions and contribute to the discussion respectfully.
            </p>
            {hasPublishedDebate && features.feature_model_debate && (
              <Link
                href={`/board/${sessionId}/debate/${selectedMotion.id}`}
                className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-3 py-1.5 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                View Model Debate
              </Link>
            )}
          </div>

          <div className="shrink-0 flex items-center gap-5 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3">
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900 leading-none">{counts.all}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Posts</p>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900 leading-none">{participantCount}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Participants</p>
            </div>
          </div>
        </div>

        {/* Motion tabs — only shown when session has multiple motions */}
        {motions.length > 1 && (
          <div className="flex gap-2 mt-4 overflow-x-auto pb-0.5">
            {motions.map(m => (
              <button
                key={m.id}
                onClick={() => { setSelectedMotionId(m.id); setFilter('all'); setExplainId(null); }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
                  m.id === selectedMotion.id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'text-slate-600 border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                {m.motion_text.length > 45 ? m.motion_text.slice(0, 45) + '…' : m.motion_text}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {filters.map(({ key, label }) => {
            const isActive = filter === key;
            const color = FILTER_COLOR[key];
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap"
                style={
                  isActive
                    ? { backgroundColor: `${color}18`, borderColor: color, color }
                    : { backgroundColor: 'transparent', borderColor: '#E2E8F0', color: '#64748B' }
                }
              >
                {label}
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={isActive ? { backgroundColor: '#ffffff80' } : { backgroundColor: '#F1F5F9' }}
                >
                  {counts[key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="flex gap-5 px-6 py-5 items-start">

        {/* Main feed — capped at readable width, left-aligned */}
        <div className="flex-1 min-w-0 max-w-[960px] flex flex-col gap-3">

          {/* In-feed entry point — always above posts, aligned with cards */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">
              What do you think?
            </p>
            <button
              onClick={() => onFormChange({ kind: 'modal-claim', motionId: selectedMotion.id })}
              className="w-full flex items-center gap-2 bg-white border border-dashed border-slate-300 rounded px-4 py-3 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-left"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="text-sm">Add your opinion</span>
            </button>
          </div>

          {filteredClusters.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-slate-400">
                {filter === 'all'
                  ? 'No posts yet. Be the first to share your opinion.'
                  : `No ${filter.toUpperCase()} posts yet.`}
              </p>
            </div>
          ) : (
            filteredClusters.map(cluster => (
              <ArgumentCluster
                key={cluster.claim.id}
                claim={cluster.claim}
                responses={cluster.responses}
                sessionId={sessionId}
                motionId={selectedMotion.id}
                motionText={selectedMotion.motion_text}
                studentId={studentId}
                form={form}
                onFormChange={onFormChange}
                onSubmitted={onSubmitted}
                onReactionChange={onReactionChange}
                onExplain={features.feature_explain_post ? setExplainId : undefined}
                onDeleted={onDeleted}
              />
            ))
          )}

          {/* Footer note */}
          <div className="flex items-start gap-2 mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-xs text-slate-400 leading-snug">
              AI labels are assigned automatically and may not be perfect.
              Please focus on the content and engage respectfully.
            </p>
          </div>
        </div>

        {/* Sidebar — reference material, clearly subordinate */}
        <div className="w-52 shrink-0 flex flex-col gap-4 sticky top-4 max-h-[calc(100vh-200px)] overflow-y-auto pb-4">
          {features.feature_explain_post && (
            <WhatDoesItMeanCard
              arg={explainArg}
              parentContent={explainParent?.content}
              motionText={selectedMotion.motion_text}
              sessionId={sessionId}
            />
          )}
          <HowToParticipateCard />
          <LegendCard />
        </div>
      </div>

      {/* ── AI Discussion Modal ────────────────────────────────────────────── */}
      {isModalOpen && (
        <AIDiscussionModal
          motionText={selectedMotion.motion_text}
          parentContent={form.kind === 'modal-response' ? form.parent.content : undefined}
          parentId={form.kind === 'modal-response' ? form.parent.id : undefined}
          threadChain={form.kind === 'modal-response' ? buildThreadChain(form.parent, argList) : undefined}
          mode={form.kind === 'modal-claim' ? 'claim' : 'response'}
          sessionId={sessionId}
          motionId={selectedMotion.id}
          studentId={studentId}
          features={{
            howToSay:      features.feature_how_to_say,
            editEnglish:   features.feature_edit_english,
            talkItThrough: features.feature_talk_it_through,
          }}
          onSubmitted={(arg) => { onFormChange({ kind: 'closed' }); onSubmitted(arg); }}
          onCancel={() => onFormChange({ kind: 'closed' })}
        />
      )}
    </div>
  );
}
