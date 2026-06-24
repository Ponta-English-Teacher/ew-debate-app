'use client';

import type { Team } from '@/types';

interface Props {
  value: Team | null;
  onChange: (team: Team) => void;
}

export default function TeamPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onChange('pro')}
        className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
          value === 'pro'
            ? 'bg-blue-50 border-blue-400 text-blue-700'
            : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'
        }`}
      >
        Pro Team
      </button>
      <button
        type="button"
        onClick={() => onChange('con')}
        className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
          value === 'con'
            ? 'bg-orange-50 border-orange-400 text-orange-700'
            : 'bg-white border-slate-200 text-slate-500 hover:border-orange-300'
        }`}
      >
        Con Team
      </button>
    </div>
  );
}
