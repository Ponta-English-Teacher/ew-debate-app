-- Migration 004: reaction types
--
-- Replaces the single "Agree" vote with two stance-agnostic reactions:
--   strong      — "Strong Argument" (💪)
--   interesting — "Interesting Point" (💡)
--
-- DEFAULT 'strong' backfills every existing ewd_votes row (the old
-- "Agree" clicks) as Strong Argument reactions in the same statement —
-- the closest available proxy, since no "interesting" signal exists
-- in the historical data.
--
-- The old UNIQUE(argument_id, student_id) constraint is replaced with
-- one scoped per reaction_type, so a student can give both reactions
-- to the same post (two rows instead of one). Its auto-generated name
-- is looked up dynamically rather than assumed, since it depends on
-- how Postgres named it when the table was first created.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run

ALTER TABLE ewd_votes
  ADD COLUMN reaction_type TEXT NOT NULL DEFAULT 'strong'
    CHECK (reaction_type IN ('strong', 'interesting'));

DO $$
DECLARE
  old_constraint TEXT;
BEGIN
  SELECT con.conname INTO old_constraint
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'ewd_votes'
    AND con.contype = 'u'
    AND con.conkey = (
      SELECT array_agg(attnum ORDER BY attnum)
      FROM pg_attribute
      WHERE attrelid = rel.oid AND attname IN ('argument_id', 'student_id')
    );

  IF old_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE ewd_votes DROP CONSTRAINT %I', old_constraint);
  END IF;
END $$;

ALTER TABLE ewd_votes
  ADD CONSTRAINT ewd_votes_argument_student_type_key
  UNIQUE (argument_id, student_id, reaction_type);

CREATE OR REPLACE VIEW ewd_arguments_with_votes AS
SELECT
  a.*,
  COALESCE(v.strong_count, 0)::INT      AS strong_count,
  COALESCE(v.interesting_count, 0)::INT AS interesting_count
FROM ewd_arguments a
LEFT JOIN (
  SELECT
    argument_id,
    COUNT(*) FILTER (WHERE reaction_type = 'strong')      AS strong_count,
    COUNT(*) FILTER (WHERE reaction_type = 'interesting') AS interesting_count
  FROM ewd_votes
  GROUP BY argument_id
) v ON v.argument_id = a.id;
