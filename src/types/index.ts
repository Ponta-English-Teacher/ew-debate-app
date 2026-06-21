// Narrow to 'en' only — the debate app is English-only.
// VoteButton and LiveFeed still reference Lang; they will be
// rewritten in Steps 8 and 10 at which point this type can be removed.
export type Lang = 'en';

// ── Sessions ────────────────────────────────────────────────────────────────

import type { SessionSettings } from '@/lib/sessionSettings';
export type { SessionSettings };

export interface Session {
  id: string;
  topic: string;
  is_active: boolean;
  class_code: string;
  created_at: string;
  // Populated by GET /api/sessions list endpoint
  motion_count?: number;
  settings?: SessionSettings | null;
}

// ── Motions ─────────────────────────────────────────────────────────────────

export interface Motion {
  id: string;
  session_id: string;
  motion_text: string;
  sort_order: number;
  created_at: string;
}

// ── Students ─────────────────────────────────────────────────────────────────

export interface Student {
  id: string;
  session_id: string;
  name: string;
  student_id: string | null; // school-issued ID, optional
  created_at: string;
}

// ── Arguments ────────────────────────────────────────────────────────────────

export type ResponseType =
  | 'claim'
  | 'support'
  | 'counter'
  | 'challenge'
  | 'question'
  | 'evidence'
  | 'distinction';

export interface Argument {
  id: string;
  session_id: string;
  motion_id: string;
  parent_id: string | null;  // null = top-level claim
  student_id: string;
  response_type: ResponseType;
  content: string;
  word_count: number;
  is_flagged: boolean;
  created_at: string;
  // Populated by ewd_arguments_with_votes view
  vote_count: number;
  // Set by the API based on the requesting student's vote record
  voted_by_me?: boolean;
  // Parent card excerpt — populated by API when parent_id is non-null
  parent?: Pick<Argument, 'id' | 'content' | 'response_type'> | null;
  // Joined from ewd_students by the GET /api/arguments endpoint
  student_name?: string | null;
}

// ── Votes ────────────────────────────────────────────────────────────────────

export interface Vote {
  id: string;
  argument_id: string;
  student_id: string;
  created_at: string;
}
