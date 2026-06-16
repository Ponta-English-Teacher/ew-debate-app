import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const session_id = searchParams.get('session_id');

  if (!session_id) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from('ewd_motions')
    .select('*')
    .eq('session_id', session_id)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const session_id = body?.session_id;
  const motion_text = body?.motion_text?.trim();
  const sort_order: number = body?.sort_order ?? 0;

  if (!session_id || !motion_text) {
    return NextResponse.json({ error: 'session_id and motion_text are required' }, { status: 400 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from('ewd_motions')
    .insert({ session_id, motion_text, sort_order })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
