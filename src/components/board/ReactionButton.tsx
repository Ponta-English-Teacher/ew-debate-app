'use client';

import { useState } from 'react';

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

interface Props {
  argumentId: string;
  voteCount: number;
  votedByMe: boolean;
  studentId: string;
  onVoteChange: (argumentId: string, voted: boolean) => void;
}

export default function ReactionButton({
  argumentId,
  voteCount,
  votedByMe,
  studentId,
  onVoteChange,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    onVoteChange(argumentId, !votedByMe);

    try {
      let ok = false;
      if (votedByMe) {
        const res = await fetch(
          `/api/arguments/${argumentId}/vote?student_id=${studentId}`,
          { method: 'DELETE' },
        );
        ok = res.ok;
      } else {
        const res = await fetch(`/api/arguments/${argumentId}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: studentId }),
        });
        ok = res.ok;
      }
      if (!ok) onVoteChange(argumentId, votedByMe);
    } catch {
      onVoteChange(argumentId, votedByMe);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={votedByMe ? 'Unlike' : 'Like'}
      className={`inline-flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-40 ${
        votedByMe
          ? 'text-rose-500'
          : 'text-slate-400 hover:text-rose-400'
      }`}
    >
      <HeartIcon filled={votedByMe} />
      <span>{voteCount}</span>
    </button>
  );
}
