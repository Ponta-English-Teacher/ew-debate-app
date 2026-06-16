const KEY = 'ew_teacher_auth';

export function isTeacherAuthed(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(KEY) === '1';
}

export function setTeacherAuthed(): void {
  sessionStorage.setItem(KEY, '1');
}
