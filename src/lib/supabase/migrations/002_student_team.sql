-- Migration 002: student team (Pro / Con)
--
-- Adds a per-student team label. Nullable so existing students/rows
-- (joined before this feature shipped) remain valid with team = NULL;
-- the app treats NULL as "no team chosen yet" and displays posts safely.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run

ALTER TABLE ewd_students
  ADD COLUMN team TEXT CHECK (team IN ('pro', 'con'));
