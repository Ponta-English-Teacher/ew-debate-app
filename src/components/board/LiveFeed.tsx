'use client';

import type { Argument } from '@/types';

// Temporary minimal adaptation — will be fully rewritten in Step 10
// (LivePulse bottom strip with response-type badges).
interface Props {
  arguments: Argument[];
  onSelect: (id: string) => void;
}

export default function LiveFeed({ arguments: args, onSelect }: Props) {
  const latest = [...args]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="flex flex-col h-full border-l border-slate-200/80 bg-white/60">
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Live Activity
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {latest.length === 0 ? (
          <p className="px-4 py-6 text-xs text-slate-400 text-center">No activity yet</p>
        ) : (
          latest.map(arg => (
            <button
              key={arg.id}
              onClick={() => onSelect(arg.id)}
              className="w-full text-left px-4 py-3 hover:bg-indigo-50/60 transition-colors flex flex-col gap-1"
            >
              <p className="text-xs text-slate-700 leading-relaxed line-clamp-2 font-medium">
                {arg.content}
              </p>
              <span className="text-xs text-indigo-500 font-semibold">💪 {arg.strong_count}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
