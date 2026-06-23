'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getStudent } from '@/lib/student';
import { getSupabaseClient } from '@/lib/supabase/client';
import { i18n } from '@/lib/i18n';
import type { Session, Motion, Argument, Student, ResponseType } from '@/types';
import { mergeSettings, DEFAULT_SETTINGS } from '@/lib/sessionSettings';
import MotionRiver from '@/components/board/MotionRiver';
import type { FormState } from '@/components/board/MotionRiver';

export default function BoardPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [motions, setMotions] = useState<Motion[]>([]);
  const [argList, setArgList] = useState<Argument[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>({ kind: 'closed' });

  // Refs for stable access inside realtime closures
  const argListRef = useRef<Argument[]>([]);
  const voteMapRef = useRef(new Map<string, { argumentId: string; studentId: string }>());

  // Keep argListRef in sync with state
  useEffect(() => { argListRef.current = argList; }, [argList]);

  // Initial data fetch
  useEffect(() => {
    if (!sessionId) return;

    const stored = getStudent(sessionId);
    if (!stored) { router.replace('/join'); return; }
    setStudent(stored);

    Promise.all([
      fetch(`/api/sessions/${sessionId}`).then(r => (r.ok ? r.json() : null)),
      fetch(`/api/motions?session_id=${sessionId}`).then(r => r.json()),
      fetch(`/api/arguments?session_id=${sessionId}&student_id=${stored.id}`).then(r => r.json()),
    ])
      .then(([s, m, a]) => {
        setSession(s);
        setMotions(Array.isArray(m) ? m : []);
        setArgList(Array.isArray(a) ? a : []);
      })
      .finally(() => setLoading(false));
  }, [sessionId, router]);

  // Realtime subscriptions — set up once student is known
  useEffect(() => {
    if (!sessionId || !student) return;

    const supabase = getSupabaseClient();
    const voteMap = voteMapRef.current;

    const channel = supabase
      .channel(`board:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ewd_arguments', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          setArgList(prev => {
            // Dedup: current client already optimistically added this arg
            if (prev.some(a => a.id === raw.id)) return prev;

            // Enrich parent from the current list
            const parentId = raw.parent_id as string | null;
            const parentArg = parentId ? argListRef.current.find(a => a.id === parentId) ?? null : null;

            const arg: Argument = {
              id: raw.id as string,
              session_id: raw.session_id as string,
              motion_id: raw.motion_id as string,
              parent_id: parentId,
              student_id: raw.student_id as string,
              response_type: raw.response_type as ResponseType,
              content: raw.content as string,
              word_count: raw.word_count as number,
              is_flagged: raw.is_flagged as boolean,
              created_at: raw.created_at as string,
              vote_count: 0,
              voted_by_me: false,
              parent: parentArg ? { id: parentArg.id, content: parentArg.content, response_type: parentArg.response_type } : null,
            };
            return [...prev, arg];
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'ewd_arguments' },
        (payload) => {
          const old = payload.old as { id: string };
          setArgList(prev => prev.filter(a => a.id !== old.id));
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ewd_votes' },
        (payload) => {
          const vote = payload.new as { id: string; argument_id: string; student_id: string };

          // Only process votes for arguments in this session
          if (!argListRef.current.some(a => a.id === vote.argument_id)) return;

          // Track for DELETE lookups (replica identity is DEFAULT — DELETE only has PK)
          voteMap.set(vote.id, { argumentId: vote.argument_id, studentId: vote.student_id });

          // Skip own votes — already handled optimistically by handleVoteChange
          if (vote.student_id === student.id) return;

          setArgList(prev => prev.map(a =>
            a.id === vote.argument_id ? { ...a, vote_count: a.vote_count + 1 } : a
          ));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'ewd_votes' },
        (payload) => {
          const old = payload.old as { id: string; argument_id?: string; student_id?: string };

          // With REPLICA IDENTITY FULL the full row is present; fall back to
          // voteMap for sessions where the migration hasn't been applied yet.
          const argumentId = old.argument_id ?? voteMap.get(old.id)?.argumentId;
          const studentId = old.student_id ?? voteMap.get(old.id)?.studentId;

          voteMap.delete(old.id);

          if (!argumentId || !studentId) return; // unknown — ignore
          if (studentId === student.id) return;   // own unvote, already optimistic

          setArgList(prev => prev.map(a =>
            a.id === argumentId ? { ...a, vote_count: Math.max(0, a.vote_count - 1) } : a
          ));
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, student]);

  function handleVoteChange(argumentId: string, voted: boolean) {
    setArgList(prev => prev.map(a =>
      a.id === argumentId
        ? { ...a, vote_count: voted ? a.vote_count + 1 : a.vote_count - 1, voted_by_me: voted }
        : a
    ));
  }

  function handleDeleted(argumentId: string) {
    setArgList(prev => prev.filter(a => a.id !== argumentId));
  }

  function handleSubmitted(arg: Argument) {
    const enriched: Argument =
      (form.kind === 'response' || form.kind === 'modal-response')
        ? { ...arg, parent: { id: form.parent.id, content: form.parent.content, response_type: form.parent.response_type } }
        : arg;
    setArgList(prev => {
      if (prev.some(a => a.id === enriched.id)) return prev;
      return [...prev, enriched];
    });
    setForm({ kind: 'closed' });
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">{i18n.common.loading}</p>
      </div>
    );
  }

  if (!session || !student) return null;

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Slim top bar — class code + student name for orientation */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-slate-600 truncate">{session.topic}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-xs font-semibold ${session.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
            {session.is_active ? i18n.teacher.active : i18n.teacher.inactive}
          </span>
          <span className="font-mono text-xs font-bold text-indigo-600 tracking-widest">
            {session.class_code}
          </span>
          <span className="text-xs text-slate-500">{student.name}</span>
        </div>
      </header>

      {/* Scrollable debate board */}
      <div className="flex-1 overflow-y-auto">
        <MotionRiver
          sessionId={sessionId}
          studentId={student.id}
          motions={motions}
          argList={argList}
          form={form}
          onFormChange={setForm}
          onSubmitted={handleSubmitted}
          onVoteChange={handleVoteChange}
          onDeleted={handleDeleted}
          features={session ? mergeSettings(session.settings) : DEFAULT_SETTINGS}
        />
      </div>
    </div>
  );
}
