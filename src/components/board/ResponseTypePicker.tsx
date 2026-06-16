'use client';

import type { ResponseType } from '@/types';
import { RESPONSE_TYPES, RESPONSE_TYPE_ORDER } from '@/lib/responseTypes';

interface Props {
  mode: 'claim' | 'response';
  selected: ResponseType | null;
  onChange: (type: ResponseType) => void;
}

export default function ResponseTypePicker({ mode, selected, onChange }: Props) {
  const types = RESPONSE_TYPE_ORDER.filter(t =>
    mode === 'claim' ? t === 'claim' : t !== 'claim'
  );

  return (
    <div className={`grid gap-2 ${types.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {types.map(type => {
        const { label, description, color } = RESPONSE_TYPES[type];
        const isSelected = selected === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`text-left rounded-xl border-2 p-3 transition-all ${
              isSelected
                ? 'shadow-sm'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
            style={isSelected
              ? { borderColor: color, backgroundColor: `${color}0d` }
              : {}
            }
          >
            <div className="text-xs font-bold mb-0.5" style={{ color }}>
              {label}
            </div>
            <div className="text-[11px] text-slate-500 leading-snug">{description}</div>
          </button>
        );
      })}
    </div>
  );
}
