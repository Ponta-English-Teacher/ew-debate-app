-- Migration 003: argument needs_answer
--
-- A single optional flag a student can set when posting: "I want this
-- answered." NOT NULL DEFAULT false means existing rows are backfilled
-- safely (false) with no further action needed.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run

ALTER TABLE ewd_arguments
  ADD COLUMN needs_answer BOOLEAN NOT NULL DEFAULT false;
