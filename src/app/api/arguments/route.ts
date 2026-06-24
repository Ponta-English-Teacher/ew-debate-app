import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { ResponseType } from '@/types';

const VALID_TYPES: ResponseType[] = [
  'claim', 'support', 'counter', 'challenge', 'question', 'evidence', 'distinction',
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const session_id = searchParams.get('session_id');
  const motion_id = searchParams.get('motion_id');
  const student_id = searchParams.get('student_id');

  if (!session_id) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  const db = createServerClient();

  let query = db
    .from('ewd_arguments_with_votes')
    .select('*')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true });

  if (motion_id) query = query.eq('motion_id', motion_id);

  const { data: args, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!args?.length) return NextResponse.json([]);

  // Build parent map so each arg can inline its parent summary
  type ArgRow = typeof args[number];
  const argMap = new Map<string, ArgRow>(args.map(a => [a.id, a]));

  // Compute strong_by_me / interesting_by_me if student_id supplied
  let strongSet = new Set<string>();
  let interestingSet = new Set<string>();
  if (student_id) {
    const { data: votes } = await db
      .from('ewd_votes')
      .select('argument_id, reaction_type')
      .eq('student_id', student_id)
      .in('argument_id', args.map(a => a.id));
    strongSet = new Set(votes?.filter(v => v.reaction_type === 'strong').map(v => v.argument_id) ?? []);
    interestingSet = new Set(votes?.filter(v => v.reaction_type === 'interesting').map(v => v.argument_id) ?? []);
  }

  // Join student names + teams for display
  const { data: students } = await db
    .from('ewd_students')
    .select('id, name, team')
    .eq('session_id', session_id);
  const studentNames = new Map<string, string>(students?.map(s => [s.id, s.name]) ?? []);
  const studentTeams = new Map<string, string | null>(students?.map(s => [s.id, s.team]) ?? []);

  const result = args.map(a => {
    const parent = a.parent_id ? argMap.get(a.parent_id) ?? null : null;
    return {
      ...a,
      strong_by_me: strongSet.has(a.id),
      interesting_by_me: interestingSet.has(a.id),
      student_name: studentNames.get(a.student_id) ?? null,
      student_team: studentTeams.get(a.student_id) ?? null,
      parent: parent
        ? { id: parent.id, content: parent.content, response_type: parent.response_type }
        : null,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { session_id, motion_id, parent_id, student_id, response_type, content, needs_answer } = body;

  if (!session_id || !motion_id || !student_id || !response_type || !content?.trim()) {
    return NextResponse.json(
      { error: 'session_id, motion_id, student_id, response_type, and content are required' },
      { status: 400 }
    );
  }

  if (!VALID_TYPES.includes(response_type)) {
    return NextResponse.json({ error: 'invalid response_type' }, { status: 400 });
  }

  const trimmed = (content as string).trim();
  const word_count = trimmed.split(/\s+/).filter(Boolean).length;

  const db = createServerClient();
  const { data, error } = await db
    .from('ewd_arguments')
    .insert({
      session_id,
      motion_id,
      parent_id: parent_id ?? null,
      student_id,
      response_type,
      content: trimmed,
      word_count,
      needs_answer: needs_answer === true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, strong_count: 0, interesting_count: 0 }, { status: 201 });
}
