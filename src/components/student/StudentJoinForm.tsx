'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setStudent } from '@/lib/student';
import { i18n } from '@/lib/i18n';
import type { Student } from '@/types';

export default function StudentJoinForm() {
  const router = useRouter();
  const t = i18n.landing;

  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [classCode, setClassCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    const trimmedCode = classCode.trim().toUpperCase();

    if (!trimmedName || !trimmedCode) {
      setError(t.required);
      return;
    }

    setLoading(true);
    try {
      // 1. Look up session by class code
      const sessionRes = await fetch(`/api/sessions/by-code/${trimmedCode}`);
      if (sessionRes.status === 404) {
        setError(t.invalidCode);
        return;
      }
      if (!sessionRes.ok) {
        setError(i18n.common.error);
        return;
      }

      const session = await sessionRes.json();

      if (!session.is_active) {
        setError(t.inactiveSession);
        return;
      }

      // 2. Register student
      const studentRes = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          name: trimmedName,
          student_id: studentId.trim() || null,
        }),
      });
      if (!studentRes.ok) {
        setError(i18n.common.error);
        return;
      }

      const student: Student = await studentRes.json();

      // 3. Persist to sessionStorage
      setStudent(student);

      // 4. Navigate to the board
      router.push(`/board/${session.id}`);
    } catch {
      setError(i18n.common.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 w-full">
      {/* Name */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          {t.nameLabel}
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t.namePlaceholder}
          autoComplete="name"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
        />
      </div>

      {/* Student ID (optional) */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          {t.studentIdLabel}
          <span className="ml-1 font-normal text-slate-400">({t.studentIdPlaceholder})</span>
        </label>
        <input
          type="text"
          value={studentId}
          onChange={e => setStudentId(e.target.value)}
          placeholder={t.studentIdPlaceholder}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
        />
      </div>

      {/* Class code */}
      <div className="mb-6">
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          {t.classCodeLabel}
        </label>
        <input
          type="text"
          value={classCode}
          onChange={e => setClassCode(e.target.value.toUpperCase())}
          placeholder={t.classCodePlaceholder}
          spellCheck={false}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono font-semibold text-slate-800 placeholder-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent tracking-widest transition"
        />
      </div>

      {error && (
        <p className="text-xs text-rose-600 mb-4 -mt-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
      >
        {loading ? i18n.common.loading : t.joinButton}
      </button>
    </form>
  );
}
