import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

// Server-side teacher authentication.
//
// TEACHER_PASSWORD        — the moderator password (server-only, never sent to the browser)
// TEACHER_SESSION_SECRET  — random value (32+ chars) used to sign the login cookie
//
// The cookie holds only "<expiry>.<signature>". The signing key is derived from
// both the secret and the current password, so changing either one invalidates
// every existing teacher login.

export const TEACHER_COOKIE = 'ew_teacher';
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours

function getConfig(): { password: string; secret: string } | null {
  const password = process.env.TEACHER_PASSWORD;
  const secret = process.env.TEACHER_SESSION_SECRET;
  if (!password || !secret || secret.length < 32) return null;
  return { password, secret };
}

export function isTeacherAuthConfigured(): boolean {
  return getConfig() !== null;
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function sign(expiry: string, cfg: { password: string; secret: string }): string {
  const key = createHmac('sha256', cfg.secret)
    .update('ew-teacher-key:')
    .update(sha256(cfg.password))
    .digest();
  return createHmac('sha256', key).update(expiry).digest('base64url');
}

// Constant-time comparison (hashing first makes lengths equal)
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

export function verifyPassword(candidate: string): boolean {
  const cfg = getConfig();
  if (!cfg) return false;
  return safeEqual(candidate, cfg.password);
}

function createToken(): string | null {
  const cfg = getConfig();
  if (!cfg) return null;
  const expiry = String(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS);
  return `${expiry}.${sign(expiry, cfg)}`;
}

function verifyToken(token: string | undefined): boolean {
  const cfg = getConfig();
  if (!cfg || !token) return false;
  const [expiry, signature] = token.split('.');
  if (!expiry || !signature || !/^\d+$/.test(expiry)) return false;
  if (Number(expiry) <= Math.floor(Date.now() / 1000)) return false;
  return safeEqual(signature, sign(expiry, cfg));
}

export function isTeacherRequest(req: NextRequest): boolean {
  return verifyToken(req.cookies.get(TEACHER_COOKIE)?.value);
}

// Reject cross-site state-changing requests (defence in depth on top of SameSite=Lax)
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser clients still need a valid cookie
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// Returns a 401/403 response if the request is not from an authenticated teacher,
// or null if the route may proceed.
export function requireTeacher(req: NextRequest): NextResponse | null {
  if (req.method !== 'GET' && req.method !== 'HEAD' && !isSameOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!isTeacherRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export function setTeacherCookie(res: NextResponse): boolean {
  const token = createToken();
  if (!token) return false;
  res.cookies.set(TEACHER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return true;
}

export function clearTeacherCookie(res: NextResponse): void {
  res.cookies.set(TEACHER_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
