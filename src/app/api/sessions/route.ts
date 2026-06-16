import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  const db = createServerClient();

  const { data: sessions, error } = await db
    .from('ewd_sessions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!sessions?.length) return NextResponse.json([]);

  const { data: motionRows } = await db
    .from('ewd_motions')
    .select('session_id')
    .in('session_id', sessions.map(s => s.id));

  const countMap = new Map<string, number>();
  motionRows?.forEach(m => {
    countMap.set(m.session_id, (countMap.get(m.session_id) ?? 0) + 1);
  });

  return NextResponse.json(
    sessions.map(s => ({ ...s, motion_count: countMap.get(s.id) ?? 0 }))
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const topic = body?.topic?.trim();
  const motions: string[] = body?.motions ?? [];

  if (!topic) return NextResponse.json({ error: 'topic is required' }, { status: 400 });

  const db = createServerClient();

  // Insert session, retrying on class_code unique collision (23505)
  let sessionData: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: code, error: rpcErr } = await db.rpc('generate_class_code');
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });

    const { data, error } = await db
      .from('ewd_sessions')
      .insert({ topic, class_code: code as string, is_active: false })
      .select()
      .single();

    if (!error) { sessionData = data as Record<string, unknown>; break; }
    if (error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!sessionData) {
    return NextResponse.json({ error: 'Failed to generate unique class code' }, { status: 500 });
  }

  if (motions.length > 0) {
    const rows = motions
      .map((text, i) => ({ session_id: sessionData!.id, motion_text: text.trim(), sort_order: i }))
      .filter(r => r.motion_text.length > 0);

    if (rows.length > 0) {
      const { error } = await db.from('ewd_motions').insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json(sessionData, { status: 201 });
}
