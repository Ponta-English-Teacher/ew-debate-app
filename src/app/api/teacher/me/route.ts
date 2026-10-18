import { NextRequest, NextResponse } from 'next/server';
import { isTeacherRequest } from '@/lib/teacherAuthServer';

// GET /api/teacher/me — { authed: boolean }
export async function GET(req: NextRequest) {
  return NextResponse.json(
    { authed: isTeacherRequest(req) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
