'use client';

import { useState } from 'react';
import type { ReactionType } from '@/types';

interface Props {
  argumentId: string;
  reactionType: ReactionType;
  icon: string;
  label: string;
  count: number;
  active: boolean;
  studentId: string;
  onReactionChange: (argumentId: string, reactionType: ReactionType, active: boolean) => void;
}

export default function ReactionButton({
  argumentId,
  reactionType,
  icon,
  label,
  count,
  active,
  studentId,
  onReactionChange,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    onReactionChange(argumentId, reactionType, !active);

    try {
      let ok = false;
      if (active) {
        const res = await fetch(
          `/api/arguments/${argumentId}/vote?student_id=${studentId}&reaction_type=${reactionType}`,
          { method: 'DELETE' },
        );
        ok = res.ok;
      } else {
        const res = await fetch(`/api/arguments/${argumentId}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: studentId, reaction_type: reactionType }),
        });
        ok = res.ok;
      }
      if (!ok) onReactionChange(argumentId, reactionType, active);
    } catch {
      onReactionChange(argumentId, reactionType, active);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={label}
      className={`inline-flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-40 rounded px-1.5 py-0.5 ${
        active
          ? 'bg-indigo-50 text-indigo-600'
          : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <span>{icon}</span>
      <span>{count}</span>
    </button>
  );
}
