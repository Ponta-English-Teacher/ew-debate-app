import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ argumentId: string }> }
) {
  const { argumentId } = await params;
  const body = await req.json();

  if (typeof body.is_flagged !== 'boolean') {
    return NextResponse.json({ error: 'is_flagged (boolean) required' }, { status: 400 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from('ewd_arguments')
    .update({ is_flagged: body.is_flagged })
    .eq('id', argumentId)
    .select()
    .single();

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}
