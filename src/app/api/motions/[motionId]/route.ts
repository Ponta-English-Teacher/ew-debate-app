import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requireTeacher } from '@/lib/teacherAuthServer';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ motionId: string }> }
) {
  const denied = requireTeacher(req);
  if (denied) return denied;

  const { motionId } = await params;
  const db = createServerClient();

  const { error } = await db
    .from('ewd_motions')
    .delete()
    .eq('id', motionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
