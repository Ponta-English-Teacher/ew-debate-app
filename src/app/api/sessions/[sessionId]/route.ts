import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const db = createServerClient();

  const { data, error } = await db
    .from('ewd_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;
  if (body.settings !== undefined && typeof body.settings === 'object' && body.settings !== null) {
    updates.settings = body.settings;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from('ewd_sessions')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const db = createServerClient();

  const { error } = await db
    .from('ewd_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
