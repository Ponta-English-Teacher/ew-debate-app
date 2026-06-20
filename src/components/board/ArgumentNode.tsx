'use client';

import type { Argument } from '@/types';
import { getLabel, LABEL_STYLE } from '@/lib/debateLabels';
import ReactionButton from './ReactionButton';

// ── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#0EA5E9', '#F97316', '#EC4899',
];

function avatarColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function displayInitial(name: string | null | undefined, id: string): string {
  return name?.[0]?.toUpperCase() ?? id[0].toUpperCase();
}

function displayName(name: string | null | undefined): string {
  if (!name?.trim()) return 'Student';
  const parts = name.trim().split(/\s+/);
  return parts.length <= 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function timeAgo(iso: string): string {
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`;
  return `${Math.floor(sec / 86400)} days ago`;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ReplyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  argument: Argument;
  studentId: string;
  replyCount?: number;
  onVoteChange: (argumentId: string, voted: boolean) => void;
  onBuildOn?: (arg: Argument) => void;
  onExplain?: (id: string) => void;
}

export default function ArgumentNode({
  argument,
  studentId,
  replyCount,
  onVoteChange,
  onBuildOn,
  onExplain,
}: Props) {
  const label = getLabel(argument.response_type);
  const style = LABEL_STYLE[label];
  const color = avatarColor(argument.student_id);

  return (
    <div
      className="bg-white rounded border border-slate-200 overflow-hidden"
      style={{ borderLeftWidth: 4, borderLeftColor: style.left }}
    >
      {/* Header — minimal, all metadata treated as secondary */}
      <div className="flex items-center gap-2 px-3 pt-1.5 pb-1 border-b border-slate-100">
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm border shrink-0 tracking-wide"
          style={{ color: style.text, backgroundColor: style.bg, borderColor: style.border }}
        >
          {label}
        </span>

        <div
          className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0"
          style={{ backgroundColor: color }}
        >
          {displayInitial(argument.student_name, argument.student_id)}
        </div>

        <span className="text-[11px] font-normal text-slate-400 flex-1 min-w-0 truncate">
          {displayName(argument.student_name)}
        </span>

        <span className="text-[11px] text-slate-300 shrink-0 whitespace-nowrap">
          {timeAgo(argument.created_at)}
        </span>
      </div>

      {/* Body — the argument itself is the primary content */}
      <p className="text-[17px] text-slate-800 leading-[1.6] px-4 pt-2 pb-2 max-w-[700px]">
        {argument.content}
      </p>

      {/* Footer — reply is primary action, agree + explain are secondary */}
      <div className="flex items-center gap-3 px-3 pb-2 pt-1.5 border-t border-slate-100">
        {onBuildOn && (
          <button
            onClick={() => onBuildOn(argument)}
            className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded px-2.5 py-1 transition-colors whitespace-nowrap"
          >
            <ReplyIcon />
            <span>Write a reply{replyCount != null && replyCount > 0 ? ` (${replyCount})` : ''}</span>
          </button>
        )}

        <div className="flex items-center gap-1 text-[11px] text-slate-400 ml-2">
          <ReactionButton
            argumentId={argument.id}
            voteCount={argument.vote_count}
            votedByMe={argument.voted_by_me ?? false}
            studentId={studentId}
            onVoteChange={onVoteChange}
          />
          <span>Agree</span>
        </div>

        {onExplain && (
          <button
            onClick={() => onExplain(argument.id)}
            className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors whitespace-nowrap"
          >
            <QuestionIcon />
            What does it mean?
          </button>
        )}
      </div>
    </div>
  );
}
