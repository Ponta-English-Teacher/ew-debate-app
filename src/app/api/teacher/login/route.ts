import { NextRequest, NextResponse } from 'next/server';
import {
  isSameOrigin,
  isTeacherAuthConfigured,
  setTeacherCookie,
  verifyPassword,
} from '@/lib/teacherAuthServer';

// POST /api/teacher/login
// Body: { password }. On success sets the HTTP-only teacher cookie.
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!isTeacherAuthConfigured()) {
    return NextResponse.json({ error: 'Teacher login is not configured on the server.' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!verifyPassword(password)) {
    // Slow down password guessing
    await new Promise(resolve => setTimeout(resolve, 1000));
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  setTeacherCookie(res);
  return res;
}
