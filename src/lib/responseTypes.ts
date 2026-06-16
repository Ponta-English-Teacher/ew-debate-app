import type { ResponseType } from '@/types';

export interface ResponseTypeConfig {
  label: string;
  description: string; // shown in ResponseTypePicker below each button
  color: string;       // hex — used for card left border and type badge
}

export const RESPONSE_TYPES: Record<ResponseType, ResponseTypeConfig> = {
  claim: {
    label: 'Claim',
    description: 'State your position on the motion.',
    color: '#6366F1', // indigo
  },
  support: {
    label: 'Support',
    description: 'Agree and add evidence or reasoning.',
    color: '#10B981', // emerald
  },
  counter: {
    label: 'Counter',
    description: 'Disagree and explain why.',
    color: '#F43F5E', // rose
  },
  challenge: {
    label: 'Challenge',
    description: 'Question the logic or assumptions.',
    color: '#F59E0B', // amber
  },
  question: {
    label: 'Question',
    description: 'Ask for clarification or more information.',
    color: '#0EA5E9', // sky
  },
  evidence: {
    label: 'Evidence',
    description: 'Cite a fact, statistic, or source.',
    color: '#8B5CF6', // violet
  },
  distinction: {
    label: 'Distinction',
    description: 'Refine or qualify a claim.',
    color: '#64748B', // slate
  },
};

// Display order for ResponseTypePicker and any ordered list rendering.
// 'claim' appears first but is hidden when responding to a parent card
// (claims can only be top-level).
export const RESPONSE_TYPE_ORDER: ResponseType[] = [
  'claim',
  'support',
  'counter',
  'challenge',
  'question',
  'evidence',
  'distinction',
];
