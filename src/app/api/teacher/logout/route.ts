import { NextResponse } from 'next/server';
import { clearTeacherCookie } from '@/lib/teacherAuthServer';

// POST /api/teacher/logout — clears the teacher cookie.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearTeacherCookie(res);
  return res;
}
