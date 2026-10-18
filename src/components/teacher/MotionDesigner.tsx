'use client';

import { useState, useEffect, useRef } from 'react';
import {
  CEFR_LEVELS,
  MAX_MESSAGE_CHARS,
  MAX_MESSAGES_IN_REQUEST,
  STAGES,
  STAGE_LABELS,
  replyToHistory,
  type Cefr,
  type ClassProfile,
  type DesignerContext,
  type DesignerMessage,
  type DesignerReply,
  type Stage,
} from '@/lib/motionDesigner';
import MotionProposalCard from './MotionProposalCard';

interface Entry {
  role:    'user' | 'assistant';
  content: string;
  reply?:  DesignerReply;
}

interface Props {
  open:     boolean;
  onClose:  () => void;
  // Puts the motion into the parent's form (never saves anything). Returns a confirmation message.
  onUseMotion:     (motion: string, topic: string | null, replaceIndex?: number) => string;
  replaceChoices?: string[];
  disabledReason?: string;
  context?:        DesignerContext;
  closeOnUse?:     boolean;
}

const GREETING = 'What would you like your students to debate, or what is your teaching goal?';

const QUICK_ACTIONS: Array<{ label: string; message: string }> = [
  { label: 'Easier',           message: 'Please make the motion easier for my students’ English level, keeping the same topic and intellectual depth.' },
  { label: 'More challenging', message: 'Please make the motion more challenging.' },
  { label: 'Narrower',         message: 'Please make the motion narrower and more specific.' },
  { label: 'Other ideas',      message: 'Please suggest other motion ideas for the same teaching goal.' },
];

export default function MotionDesigner({
  open, onClose, onUseMotion, replaceChoices, disabledReason, context, closeOnUse,
}: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [profile, setProfile] = useState<ClassProfile>({ stage: null, cefr: null });
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [notice,  setNotice]  = useState('');
  const [lastTopic, setLastTopic] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, loading, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const hasProposals = entries.some(e => e.reply?.proposals.length);
  const tooLong = entries.length >= MAX_MESSAGES_IN_REQUEST - 1;

  async function send(text: string, base: Entry[] = entries) {
    const content = text.trim();
    if (!content || loading) return;
    const next: Entry[] = [...base, { role: 'user', content }];
    setEntries(next);
    setInput('');
    setError('');
    setNotice('');
    setLoading(true);

    const messages: DesignerMessage[] = next.map(e => ({
      role: e.role,
      content: e.reply ? replyToHistory(e.reply) : e.content,
    }));

    try {
      const res = await fetch('/api/ai/motion-designer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, profile, context }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'The AI is unavailable. Please try again.');
        return;
      }
      const reply = data as DesignerReply;
      setEntries([...next, { role: 'assistant', content: reply.message, reply }]);
      setProfile(prev => ({
        stage: reply.profile.stage ?? prev.stage,
        cefr:  reply.profile.cefr ?? prev.cefr,
      }));
      if (reply.topic) setLastTopic(reply.topic);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function retry() {
    const last = entries[entries.length - 1];
    if (last?.role === 'user') send(last.content, entries.slice(0, -1));
  }

  function newConversation() {
    setEntries([]);
    setError('');
    setNotice('');
    setLastTopic(null);
    setInput('');
  }

  function handleUse(motion: string, replaceIndex?: number) {
    const msg = onUseMotion(motion, lastTopic, replaceIndex);
    if (closeOnUse) onClose();
    else setNotice(msg);
  }

  function handleRefine(motion: string) {
    setInput(`Let's refine "${motion}": `);
    inputRef.current?.focus();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="AI Motion Designer"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-800">✨ AI Motion Designer</h2>
            <p className="text-[11px] text-slate-400">Develop motions with an AI teaching partner. Nothing is saved until you add it yourself.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {entries.length > 0 && (
              <button
                type="button"
                onClick={newConversation}
                className="text-[11px] text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-2 py-1 transition-colors"
              >
                New conversation
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 text-base leading-none p-0.5">✕</button>
          </div>
        </div>

        {/* Class profile */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 bg-slate-50 border-b border-slate-100">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            Students
            <select
              value={profile.stage ?? ''}
              onChange={e => setProfile(p => ({ ...p, stage: (e.target.value || null) as Stage | null }))}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Not set</option>
              {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            English (CEFR)
            <select
              value={profile.cefr ?? ''}
              onChange={e => setProfile(p => ({ ...p, cefr: (e.target.value || null) as Cefr | null }))}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Not set</option>
              {CEFR_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>

        {/* Conversation */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 bg-slate-50/50">
          <Bubble role="assistant" content={GREETING} />
          {entries.map((e, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Bubble role={e.role} content={e.content} />
              {e.reply?.proposals.map((p, j) => (
                <MotionProposalCard
                  key={j}
                  proposal={p}
                  replaceChoices={replaceChoices}
                  disabledReason={disabledReason}
                  onUse={idx => handleUse(p.motion, idx)}
                  onRefine={() => handleRefine(p.motion)}
                />
              ))}
            </div>
          ))}
          {loading && <p className="text-xs text-slate-400 animate-pulse">Thinking…</p>}
          {error && (
            <div className="text-xs text-rose-600 flex items-center gap-2">
              {error}
              <button type="button" onClick={retry} className="underline hover:text-rose-800">Retry</button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-3">
          {notice && (
            <p className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 mb-2">
              ✓ {notice}
            </p>
          )}
          {tooLong ? (
            <p className="text-xs text-slate-500">
              This conversation is getting long. Start a new conversation to continue.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {QUICK_ACTIONS.map(a => (
                  <button
                    key={a.label}
                    type="button"
                    disabled={!hasProposals || loading}
                    onClick={() => send(a.message)}
                    className="text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 disabled:hover:bg-indigo-50 rounded-full px-2.5 py-1 transition-colors"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <form
                onSubmit={e => { e.preventDefault(); send(input); }}
                className="flex gap-2 items-end"
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  maxLength={MAX_MESSAGE_CHARS}
                  rows={2}
                  placeholder="Type a message… (Enter to send, Shift+Enter for a new line)"
                  className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg px-4 py-2.5 transition-colors"
                >
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
        role === 'user'
          ? 'bg-indigo-600 text-white'
          : 'bg-white border border-slate-200 text-slate-700'
      }`}>
        {content}
      </div>
    </div>
  );
}
