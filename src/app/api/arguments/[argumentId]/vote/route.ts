import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { ReactionType } from '@/types';

const VALID_REACTION_TYPES: ReactionType[] = ['strong', 'interesting'];

// POST — add reaction. Idempotent: returns { voted: true } even if already exists.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ argumentId: string }> }
) {
  const { argumentId } = await params;
  const body = await req.json();
  const student_id = body?.student_id;
  const reaction_type = body?.reaction_type;

  if (!student_id) {
    return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
  }
  if (!VALID_REACTION_TYPES.includes(reaction_type)) {
    return NextResponse.json({ error: 'reaction_type must be "strong" or "interesting"' }, { status: 400 });
  }

  const db = createServerClient();

  const { error } = await db
    .from('ewd_votes')
    .insert({ argument_id: argumentId, student_id, reaction_type });

  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ voted: true });
}

// DELETE — remove reaction. Query params: ?student_id=xxx&reaction_type=strong
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ argumentId: string }> }
) {
  const { argumentId } = await params;
  const { searchParams } = new URL(req.url);
  const student_id = searchParams.get('student_id');
  const reaction_type = searchParams.get('reaction_type');

  if (!student_id) {
    return NextResponse.json({ error: 'student_id query param is required' }, { status: 400 });
  }
  if (!VALID_REACTION_TYPES.includes(reaction_type as ReactionType)) {
    return NextResponse.json({ error: 'reaction_type must be "strong" or "interesting"' }, { status: 400 });
  }

  const db = createServerClient();

  const { error } = await db
    .from('ewd_votes')
    .delete()
    .eq('argument_id', argumentId)
    .eq('student_id', student_id)
    .eq('reaction_type', reaction_type);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ voted: false });
}
