-- =============================================================
-- EW Debate App — Supabase Database Schema
-- Table prefix: ewd_  (coexists safely with cdb_ tables)
--
-- Run this file in the Supabase SQL Editor:
--   Dashboard → SQL Editor → New query → paste → Run
-- =============================================================


-- =============================================================
-- RESET — uncomment to wipe all ewd_ objects and start over.
-- Run in this order (reverse of creation) to respect FK deps.
-- =============================================================
-- DROP VIEW     IF EXISTS ewd_arguments_with_votes;
-- DROP TABLE    IF EXISTS ewd_votes       CASCADE;
-- DROP TABLE    IF EXISTS ewd_arguments   CASCADE;
-- DROP TABLE    IF EXISTS ewd_students    CASCADE;
-- DROP TABLE    IF EXISTS ewd_motions     CASCADE;
-- DROP TABLE    IF EXISTS ewd_sessions    CASCADE;
-- DROP FUNCTION IF EXISTS generate_class_code();


-- =============================================================
-- FUNCTION: generate_class_code()
-- Produces a random 6-character join code in the format EW-XXXX.
-- The charset omits easily-confused characters: 0, 1, I, L, O.
-- The API route calls this when inserting a new session row.
-- Example output: EW-4F2A, EW-RK9B, EW-3ZNQ
-- =============================================================
CREATE OR REPLACE FUNCTION generate_class_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  TEXT := 'EW-';
  i     INT;
BEGIN
  FOR i IN 1..4 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;


-- =============================================================
-- TABLE: ewd_sessions
-- One row per class session created by the teacher.
-- class_code is the short human-readable join code students type
-- when entering the app (e.g. EW-4F2A). Enforced UNIQUE by DB.
-- is_active lets the teacher open and close the board.
-- =============================================================
CREATE TABLE ewd_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic       TEXT        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT false,
  class_code  TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================
-- TABLE: ewd_motions
-- 2–3 debate motions per session, written manually by the teacher
-- in Phase 1 (AI generation is Phase 2).
-- sort_order controls the display order of the motion tabs/lanes.
-- =============================================================
CREATE TABLE ewd_motions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        NOT NULL REFERENCES ewd_sessions(id) ON DELETE CASCADE,
  motion_text  TEXT        NOT NULL,
  sort_order   INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================
-- TABLE: ewd_students
-- One row per student per session.
-- student_id is the school-issued alphanumeric ID (optional).
-- The DB row UUID is stored in the student's browser sessionStorage
-- so the client can identify them across page loads without login.
-- =============================================================
CREATE TABLE ewd_students (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES ewd_sessions(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  student_id  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================
-- TABLE: ewd_arguments
-- Core content unit — one row per argument card on the board.
--
-- parent_id NULL  →  top-level claim (no parent card)
-- parent_id set   →  response to an existing argument card
--
-- response_type is enforced by a CHECK constraint. Valid values:
--   claim       — an initial position on the motion
--   support     — agrees with and builds on a claim
--   counter     — disagrees and provides a reason
--   challenge   — questions the logic or assumptions
--   question    — asks for clarification or more information
--   evidence    — cites a fact, statistic, or source
--   distinction — refines or qualifies a claim
--
-- word_count is computed server-side on insert (used for dashboard
-- statistics). It is never updated after insert.
--
-- is_flagged is set to true by the teacher via PATCH to mark a
-- card as "Challenge This". Visible to all students in realtime.
-- =============================================================
CREATE TABLE ewd_arguments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID        NOT NULL REFERENCES ewd_sessions(id)  ON DELETE CASCADE,
  motion_id      UUID        NOT NULL REFERENCES ewd_motions(id)   ON DELETE CASCADE,
  parent_id      UUID                 REFERENCES ewd_arguments(id) ON DELETE SET NULL,
  student_id     UUID        NOT NULL REFERENCES ewd_students(id)  ON DELETE CASCADE,
  response_type  TEXT        NOT NULL CHECK (response_type IN (
                   'claim',
                   'support',
                   'counter',
                   'challenge',
                   'question',
                   'evidence',
                   'distinction'
                 )),
  content        TEXT        NOT NULL,
  word_count     INT         NOT NULL DEFAULT 0,
  is_flagged     BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================
-- TABLE: ewd_votes
-- One row per (argument, student) pair.
-- The UNIQUE constraint enforces no double-voting at the DB level.
-- Deleting a row removes the vote (toggle behaviour handled in API).
-- =============================================================
CREATE TABLE ewd_votes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  argument_id  UUID        NOT NULL REFERENCES ewd_arguments(id) ON DELETE CASCADE,
  student_id   UUID        NOT NULL REFERENCES ewd_students(id)  ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (argument_id, student_id)
);


-- =============================================================
-- VIEW: ewd_arguments_with_votes
-- Joins ewd_arguments with an aggregated vote count.
-- API routes query this view (not the base table) whenever
-- vote counts need to be included in the response.
-- The COALESCE ensures arguments with zero votes return 0, not NULL.
-- =============================================================
CREATE OR REPLACE VIEW ewd_arguments_with_votes AS
SELECT
  a.*,
  COALESCE(v.vote_count, 0)::INT AS vote_count
FROM ewd_arguments a
LEFT JOIN (
  SELECT   argument_id,
           COUNT(*) AS vote_count
  FROM     ewd_votes
  GROUP BY argument_id
) v ON v.argument_id = a.id;


-- =============================================================
-- REALTIME
-- Enables Supabase Realtime push for live board updates.
-- Students see new argument cards, vote count changes, motion
-- additions, and student joins without refreshing the page.
-- =============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE ewd_arguments;
ALTER PUBLICATION supabase_realtime ADD TABLE ewd_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE ewd_motions;
ALTER PUBLICATION supabase_realtime ADD TABLE ewd_students;
