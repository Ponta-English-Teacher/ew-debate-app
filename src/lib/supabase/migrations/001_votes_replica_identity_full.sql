-- Migration 001: votes replica identity full
--
-- Without this, Supabase realtime DELETE events on ewd_votes only carry
-- the primary key (id). With REPLICA IDENTITY FULL, the full old row
-- (argument_id, student_id, created_at) is included in the DELETE payload,
-- so the client can update vote counts without a local lookup cache.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run

ALTER TABLE ewd_votes REPLICA IDENTITY FULL;
