import type { ResponseType } from '@/types';

export type DebateLabel = 'PRO' | 'CON' | 'QUESTION' | 'OTHER';

export function getLabel(rt: ResponseType): DebateLabel {
  if (rt === 'claim' || rt === 'support') return 'PRO';
  if (rt === 'counter' || rt === 'challenge') return 'CON';
  if (rt === 'question') return 'QUESTION';
  return 'OTHER'; // evidence, distinction
}

export const LABEL_STYLE: Record<DebateLabel, { text: string; bg: string; border: string; left: string }> = {
  PRO:      { text: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0', left: '#16A34A' },
  CON:      { text: '#DC2626', bg: '#FEE2E2', border: '#FECACA', left: '#DC2626' },
  QUESTION: { text: '#D97706', bg: '#FEF3C7', border: '#FDE68A', left: '#D97706' },
  OTHER:    { text: '#64748B', bg: '#F1F5F9', border: '#E2E8F0', left: '#94A3B8' },
};
