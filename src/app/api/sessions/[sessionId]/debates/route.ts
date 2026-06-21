import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/sessions/[sessionId]/debates?motionId=...
// No auth → returns published debate only (student view)
// With valid Bearer auth → returns any debate for the motion (teacher view)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const { searchParams } = new URL(req.url);
  const motionId = searchParams.get('motionId');

  if (!motionId) {
    return NextResponse.json({ error: 'motionId is required' }, { status: 400 });
  }

  const auth = req.headers.get('authorization');
  const expected = process.env.NEXT_PUBLIC_MODERATOR_PASSWORD;
  const isTeacher = expected && auth === `Bearer ${expected}`;

  const db = createServerClient();

  let query = db
    .from('ewd_debates')
    .select('*')
    .eq('session_id', sessionId)
    .eq('motion_id', motionId)
    .single();

  if (!isTeacher) {
    // @ts-expect-error — chaining .eq after .single() is valid at runtime
    query = query.eq('published', true);
  }

  const { data, error } = await query;

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

// POST /api/sessions/[sessionId]/debates
// Auth required. Upserts debate for the given motion (one per motion).
// Body: { motionId, title, segments, published }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  const auth = req.headers.get('authorization');
  const expected = process.env.NEXT_PUBLIC_MODERATOR_PASSWORD;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { motionId, title, segments, published = false } = body;

  if (!motionId || !Array.isArray(segments)) {
    return NextResponse.json({ error: 'motionId and segments are required' }, { status: 400 });
  }

  const db = createServerClient();

  // Verify the motion belongs to this session
  const { data: motion } = await db
    .from('ewd_motions')
    .select('id')
    .eq('id', motionId)
    .eq('session_id', sessionId)
    .single();

  if (!motion) {
    return NextResponse.json({ error: 'Motion not found' }, { status: 404 });
  }

  const { data, error } = await db
    .from('ewd_debates')
    .upsert(
      {
        session_id: sessionId,
        motion_id:  motionId,
        title:      title ?? '',
        segments,
        published,
      },
      { onConflict: 'motion_id' },
    )
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to save debate' }, { status: 500 });
  }

  return NextResponse.json(data);
}
