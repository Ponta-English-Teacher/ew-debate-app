import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const session_id = body?.session_id;
  const name = body?.name?.trim();
  const student_id = body?.student_id?.trim() || null;

  if (!session_id || !name) {
    return NextResponse.json({ error: 'session_id and name are required' }, { status: 400 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from('ewd_students')
    .insert({ session_id, name, student_id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
