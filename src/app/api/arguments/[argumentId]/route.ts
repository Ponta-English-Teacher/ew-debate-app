import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ argumentId: string }> }
) {
  const { argumentId } = await params;
  const body = await req.json();

  if (typeof body.is_flagged !== 'boolean') {
    return NextResponse.json({ error: 'is_flagged (boolean) required' }, { status: 400 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from('ewd_arguments')
    .update({ is_flagged: body.is_flagged })
    .eq('id', argumentId)
    .select()
    .single();

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}

// DELETE — remove a post. Query param: ?student_id=xxx (must be the author).
// Refuses to delete posts that have replies, to avoid orphaning a thread.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ argumentId: string }> }
) {
  const { argumentId } = await params;
  const { searchParams } = new URL(req.url);
  const student_id = searchParams.get('student_id');

  if (!student_id) {
    return NextResponse.json({ error: 'student_id query param is required' }, { status: 400 });
  }

  const db = createServerClient();

  const { data: argument, error: fetchErr } = await db
    .from('ewd_arguments')
    .select('id, student_id')
    .eq('id', argumentId)
    .single();

  if (fetchErr || !argument) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  if (argument.student_id !== student_id) {
    return NextResponse.json({ error: 'You can only delete your own posts' }, { status: 403 });
  }

  const { count, error: replyErr } = await db
    .from('ewd_arguments')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', argumentId);

  if (replyErr) {
    return NextResponse.json({ error: replyErr.message }, { status: 500 });
  }

  if (count && count > 0) {
    return NextResponse.json(
      { error: 'You cannot delete a post that has replies' },
      { status: 409 },
    );
  }

  const { error: deleteErr } = await db
    .from('ewd_arguments')
    .delete()
    .eq('id', argumentId);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
