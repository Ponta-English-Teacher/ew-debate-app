import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// POST /api/sessions/[sessionId]/reset
// Deletes all arguments and votes for a session.
// Requires Authorization: Bearer <NEXT_PUBLIC_MODERATOR_PASSWORD>.
// Does NOT delete the session, motions, or students.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  // Server-side password check — prevents direct API calls without auth
  const auth = req.headers.get('authorization');
  const expected = process.env.NEXT_PUBLIC_MODERATOR_PASSWORD;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServerClient();

  // Confirm session exists before touching anything
  const { data: session, error: sessionErr } = await db
    .from('ewd_sessions')
    .select('id')
    .eq('id', sessionId)
    .single();

  if (sessionErr || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Collect argument IDs so we can delete votes explicitly before arguments
  const { data: args, error: fetchErr } = await db
    .from('ewd_arguments')
    .select('id')
    .eq('session_id', sessionId);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const argIds = (args ?? []).map(a => a.id);

  if (argIds.length === 0) {
    return NextResponse.json({ ok: true, deleted_arguments: 0, deleted_votes: 0 });
  }

  // Step 1: Delete votes (ewd_votes.argument_id → ewd_arguments ON DELETE CASCADE,
  // but explicit deletion here avoids any timing issues with the cascade)
  const { error: votesErr } = await db
    .from('ewd_votes')
    .delete()
    .in('argument_id', argIds);

  if (votesErr) {
    return NextResponse.json({ error: `Failed to delete votes: ${votesErr.message}` }, { status: 500 });
  }

  // Step 2: Nullify parent_id to break the self-referential FK
  // (ewd_arguments.parent_id → ewd_arguments ON DELETE SET NULL).
  // Without this, deleting a parent in the same batch can race against
  // the SET NULL trigger on its children.
  const { error: nullifyErr } = await db
    .from('ewd_arguments')
    .update({ parent_id: null })
    .eq('session_id', sessionId);

  if (nullifyErr) {
    return NextResponse.json({ error: `Failed to nullify parent refs: ${nullifyErr.message}` }, { status: 500 });
  }

  // Step 3: Delete all arguments for the session
  const { error: argsErr } = await db
    .from('ewd_arguments')
    .delete()
    .eq('session_id', sessionId);

  if (argsErr) {
    return NextResponse.json({ error: `Failed to delete arguments: ${argsErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    deleted_arguments: argIds.length,
  });
}
