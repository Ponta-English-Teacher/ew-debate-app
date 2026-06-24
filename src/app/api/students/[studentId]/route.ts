import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// PATCH — set a student's team. Used as a one-time safety net for students
// who joined before the team feature shipped (their row has team = NULL).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  const body = await req.json();
  const team = body?.team;

  if (team !== 'pro' && team !== 'con') {
    return NextResponse.json({ error: "team must be 'pro' or 'con'" }, { status: 400 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from('ewd_students')
    .update({ team })
    .eq('id', studentId)
    .select()
    .single();

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}
