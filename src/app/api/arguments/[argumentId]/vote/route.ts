import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// POST — add vote. Idempotent: returns { voted: true } even if already exists.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ argumentId: string }> }
) {
  const { argumentId } = await params;
  const body = await req.json();
  const student_id = body?.student_id;

  if (!student_id) {
    return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
  }

  const db = createServerClient();

  const { error } = await db
    .from('ewd_votes')
    .insert({ argument_id: argumentId, student_id });

  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ voted: true });
}

// DELETE — remove vote. Query param: ?student_id=xxx
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

  const { error } = await db
    .from('ewd_votes')
    .delete()
    .eq('argument_id', argumentId)
    .eq('student_id', student_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ voted: false });
}
