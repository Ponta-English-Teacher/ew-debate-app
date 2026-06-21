import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// PATCH /api/debates/[debateId]
// Auth required. Updates the published flag (and nothing else).
// Body: { published: boolean }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ debateId: string }> },
) {
  const { debateId } = await params;

  const auth = req.headers.get('authorization');
  const expected = process.env.NEXT_PUBLIC_MODERATOR_PASSWORD;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { published } = body;

  if (typeof published !== 'boolean') {
    return NextResponse.json({ error: 'published (boolean) is required' }, { status: 400 });
  }

  const db = createServerClient();

  const { data, error } = await db
    .from('ewd_debates')
    .update({ published })
    .eq('id', debateId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 500 });
  }

  return NextResponse.json(data);
}
