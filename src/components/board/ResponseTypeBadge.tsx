import type { ResponseType } from '@/types';
import { RESPONSE_TYPES } from '@/lib/responseTypes';

interface Props {
  type: ResponseType;
  size?: 'xs' | 'sm';
}

export default function ResponseTypeBadge({ type, size = 'sm' }: Props) {
  const { label, color } = RESPONSE_TYPES[type];
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${
        size === 'sm' ? 'text-[11px] px-2.5 py-0.5' : 'text-[10px] px-2 py-0.5'
      }`}
      style={{
        color,
        backgroundColor: `${color}14`,
        borderColor: `${color}35`,
      }}
    >
      {label}
    </span>
  );
}
