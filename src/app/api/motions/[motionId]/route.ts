import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ motionId: string }> }
) {
  const { motionId } = await params;
  const db = createServerClient();

  const { error } = await db
    .from('ewd_motions')
    .delete()
    .eq('id', motionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
