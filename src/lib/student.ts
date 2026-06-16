import type { Student } from '@/types';

// Keyed by session ID so a student can join multiple sessions
// in the same browser without being asked to re-enter their details.
function storageKey(sessionId: string): string {
  return `student_${sessionId}`;
}

export function getStudent(sessionId: string): Student | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(storageKey(sessionId));
    return raw ? (JSON.parse(raw) as Student) : null;
  } catch {
    return null;
  }
}

// Called after POST /api/students succeeds and returns the DB row.
// Stores the full student record (including the DB-generated UUID)
// so the client can attach student_id to all subsequent API calls.
export function setStudent(student: Student): void {
  sessionStorage.setItem(storageKey(student.session_id), JSON.stringify(student));
}

export function clearStudent(sessionId: string): void {
  sessionStorage.removeItem(storageKey(sessionId));
}
