'use client';

import { useState, useRef, useEffect } from 'react';
import type { Argument, ResponseType } from '@/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  motionText: string;
  parentContent?: string;
  parentId?: string;
  mode: 'claim' | 'response';
  sessionId: string;
  motionId: string;
  studentId: string;
  onSubmitted: (arg: Argument) => void;
  onCancel: () => void;
}

type Helper = 'express' | 'check' | 'discuss' | null;

const inputClass =
  'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 leading-relaxed';

export default function AIDiscussionModal({
  motionText,
  parentContent,
  parentId,
  mode,
  sessionId,
  motionId,
  studentId,
  onSubmitted,
  onCancel,
}: Props) {
  // ── Main textbox ───────────────────────────────────────────────────────────
  const [draft, setDraft] = useState('');
  // Tracks AI-suggested response_type; updated when AI provides one
  const [responseType, setResponseType] = useState<ResponseType>(
    mode === 'claim' ? 'claim' : 'support'
  );

  // ── Which helper panel is open ─────────────────────────────────────────────
  const [helper, setHelper] = useState<Helper>(null);

  // ── Express (How to say it) state ─────────────────────────────────────────
  const [expressMessages, setExpressMessages] = useState<Message[]>([]);
  const [expressReply, setExpressReply]       = useState('');
  const [expressOptions, setExpressOptions]   = useState<string[]>([]);

  // ── Check (Correct Mistakes) state ────────────────────────────────────────
  const [checkSuggestion, setCheckSuggestion] = useState<string | null>(null);

  // ── Discuss (Talk it through) state ───────────────────────────────────────
  const [discussMessages, setDiscussMessages]     = useState<Message[]>([]);
  const [discussReply, setDiscussReply]           = useState('');
  const [discussSuggestion, setDiscussSuggestion] = useState<string | null>(null);

  // ── Shared ─────────────────────────────────────────────────────────────────
  const [isThinking, setIsThinking] = useState(false);
  const [posting, setPosting]       = useState(false);
  const [error, setError]           = useState('');

  const mainTextareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef       = useRef<HTMLDivElement>(null);

  useEffect(() => { mainTextareaRef.current?.focus(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [expressOptions, expressMessages, checkSuggestion, discussMessages, discussSuggestion, isThinking]);

  // ── Shared AI fetch ────────────────────────────────────────────────────────

  async function callAI(body: object): Promise<Record<string, unknown> | null> {
    setIsThinking(true);
    setError('');
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError('Could not reach the AI. Try again.'); return null; }
      return await res.json() as Record<string, unknown>;
    } catch {
      setError('Could not reach the AI. Try again.');
      return null;
    } finally {
      setIsThinking(false);
    }
  }

  // ── Express (How to say it) ────────────────────────────────────────────────

  async function activateExpress() {
    const text = draft.trim();
    if (!text) return;
    setHelper('express');
    setExpressOptions([]);
    const userMsg: Message = { role: 'user', content: text };
    const msgs = [userMsg];
    setExpressMessages(msgs);
    const data = await callAI({ messages: msgs, motionText, parentContent, mode, helpMode: 'express' });
    if (!data) return;
    if (data.phase === 'options') {
      setExpressOptions(data.options as string[]);
    } else if (data.phase === 'dialogue') {
      setExpressMessages(prev => [...prev, { role: 'assistant', content: data.message as string }]);
    }
  }

  async function sendExpressReply() {
    const text = expressReply.trim();
    if (!text) return;
    const userMsg: Message = { role: 'user', content: text };
    const updated = [...expressMessages, userMsg];
    setExpressMessages(updated);
    setExpressReply('');
    const data = await callAI({ messages: updated, motionText, parentContent, mode, helpMode: 'express' });
    if (!data) return;
    if (data.phase === 'options') {
      setExpressOptions(data.options as string[]);
    } else if (data.phase === 'dialogue') {
      setExpressMessages(prev => [...prev, { role: 'assistant', content: data.message as string }]);
    }
  }

  function useExpressOption(option: string) {
    setDraft(option);
    setHelper(null);
    setExpressMessages([]);
    setExpressOptions([]);
  }

  // ── Check (Correct Mistakes) ───────────────────────────────────────────────

  async function activateCheck() {
    const text = draft.trim();
    if (!text) return;
    setHelper('check');
    setCheckSuggestion(null);
    const data = await callAI({
      messages: [{ role: 'user', content: text }],
      motionText, parentContent, mode,
      helpMode: 'check',
    });
    if (!data) return;
    if (data.phase === 'draft') {
      setCheckSuggestion(data.suggestion as string);
      if (data.response_type) setResponseType(data.response_type as ResponseType);
    }
  }

  function useCheckSuggestion() {
    if (!checkSuggestion) return;
    setDraft(checkSuggestion);
    setHelper(null);
    setCheckSuggestion(null);
  }

  // ── Discuss (Talk it through) ──────────────────────────────────────────────

  async function activateDiscuss() {
    setHelper('discuss');
    setDiscussSuggestion(null);
    const text = draft.trim();
    if (!text) {
      setDiscussMessages([]);
      return;
    }
    const userMsg: Message = { role: 'user', content: text };
    const msgs = [userMsg];
    setDiscussMessages(msgs);
    await runDiscuss(msgs);
  }

  async function runDiscuss(msgs: Message[], currentDraft?: string) {
    const data = await callAI({
      messages: msgs,
      motionText, parentContent, mode,
      helpMode: 'discuss',
      currentDraft: currentDraft ?? null,
    });
    if (!data) return;
    if (data.phase === 'draft') {
      setDiscussSuggestion(data.suggestion as string);
      if (data.response_type) setResponseType(data.response_type as ResponseType);
      if (data.message) {
        setDiscussMessages(prev => [...prev, { role: 'assistant', content: data.message as string }]);
      }
    } else {
      setDiscussMessages(prev => [...prev, { role: 'assistant', content: data.message as string }]);
    }
  }

  async function sendDiscussReply() {
    const text = discussReply.trim();
    if (!text) return;
    const userMsg: Message = { role: 'user', content: text };
    const updated = [...discussMessages, userMsg];
    setDiscussMessages(updated);
    setDiscussReply('');
    await runDiscuss(updated, discussSuggestion ?? undefined);
  }

  function useDiscussSuggestion() {
    if (!discussSuggestion) return;
    setDraft(discussSuggestion);
    setDiscussSuggestion(null);
    // Keep discuss panel open — student may continue refining
  }

  // ── Post ───────────────────────────────────────────────────────────────────

  async function handlePost() {
    const content = draft.trim();
    if (!content) return;
    setPosting(true);
    setError('');
    try {
      const res = await fetch('/api/arguments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          motion_id: motionId,
          parent_id: parentId ?? null,
          student_id: studentId,
          response_type: responseType,
          content,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? 'Could not post. Try again.');
        return;
      }
      const arg: Argument = await res.json();
      onSubmitted(arg);
    } catch {
      setError('Could not post. Try again.');
    } finally {
      setPosting(false);
    }
  }

  // ── Shared bubble style helper ─────────────────────────────────────────────

  function bubble(msg: Message, i: number) {
    return (
      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
          msg.role === 'user'
            ? 'bg-indigo-600 text-white'
            : 'bg-white border border-slate-200 text-slate-700'
        }`}>
          {msg.content}
        </div>
      </div>
    );
  }

  function thinkingDot() {
    return (
      <div className="flex justify-start">
        <div className="bg-white border border-slate-200 text-slate-400 rounded-xl px-3 py-2 text-xs animate-pulse">…</div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex-1 min-w-0 pr-3">
            {parentContent ? (
              <>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">About this:</p>
                <p className="text-xs text-slate-600 line-clamp-2 leading-snug">{parentContent}</p>
              </>
            ) : (
              <p className="text-xs text-slate-600 line-clamp-2 leading-snug">{motionText}</p>
            )}
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 text-base leading-none flex-shrink-0 p-0.5"
          >✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          {/* ── Main textbox (always visible) ──────────────────────────────── */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">What do you think?</p>
            <textarea
              ref={mainTextareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Write here — English, Japanese, or rough ideas are all fine"
              rows={4}
              className={inputClass}
            />
          </div>

          {/* ── Post button (always visible, always posts the main textbox) ── */}
          <button
            onClick={handlePost}
            disabled={!draft.trim() || posting || isThinking}
            className="w-full text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 transition-colors"
          >
            {posting ? 'Posting…' : 'Post this →'}
          </button>

          {/* ── Helper selector ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">or get help</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'express' as const, label: 'How to say it',    needsDraft: true  },
                { id: 'check'   as const, label: 'Edit English',     needsDraft: true  },
                { id: 'discuss' as const, label: 'Talk it through',  needsDraft: false },
              ]).map(({ id, label, needsDraft }) => (
                <button
                  key={id}
                  onClick={() => {
                    if (helper === id) { setHelper(null); return; }
                    if (id === 'express') activateExpress();
                    else if (id === 'check') activateCheck();
                    else activateDiscuss();
                  }}
                  disabled={(needsDraft && !draft.trim()) || (isThinking && helper !== id)}
                  className={`text-xs font-medium border rounded-lg px-2 py-2.5 transition-colors disabled:opacity-40 ${
                    helper === id
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── EXPRESS PANEL (How to say it) ───────────────────────────────── */}
          {helper === 'express' && (
            <div className="flex flex-col gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">How to say it</p>

              {/* Conversation (only shown when AI asked a clarification) */}
              {expressMessages.some(m => m.role === 'assistant') && (
                <div className="flex flex-col gap-2">
                  {expressMessages.map((m, i) => bubble(m, i))}
                </div>
              )}

              {isThinking && thinkingDot()}

              {/* Reply input — shown when AI asked a clarification and no options yet */}
              {!isThinking && expressMessages.some(m => m.role === 'assistant') && expressOptions.length === 0 && (
                <div className="flex gap-2">
                  <input
                    value={expressReply}
                    onChange={e => setExpressReply(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendExpressReply(); } }}
                    placeholder="Reply…"
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    onClick={sendExpressReply}
                    disabled={!expressReply.trim()}
                    className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 transition-colors"
                  >Send</button>
                </div>
              )}

              {/* Options — click to copy into main textbox */}
              {!isThinking && expressOptions.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-slate-500">Choose a version — click to use it:</p>
                  {expressOptions.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => useExpressOption(opt)}
                      className="text-left text-sm rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 transition-colors leading-relaxed"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CHECK PANEL (Correct Mistakes) ──────────────────────────────── */}
          {helper === 'check' && (
            <div className="flex flex-col gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Corrected version</p>

              {isThinking && thinkingDot()}

              {!isThinking && checkSuggestion && (
                <>
                  <p className="text-sm text-slate-800 leading-relaxed bg-white border border-slate-200 rounded-lg px-3 py-2.5">
                    {checkSuggestion}
                  </p>
                  <button
                    onClick={useCheckSuggestion}
                    className="self-end text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-1.5 transition-colors"
                  >
                    Use Suggestion ←
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── DISCUSS PANEL (Talk it through) ─────────────────────────────── */}
          {helper === 'discuss' && (
            <div className="flex flex-col gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Talk it through</p>

              {/* Chat messages */}
              {discussMessages.length > 0 && (
                <div className="flex flex-col gap-2">
                  {discussMessages.map((m, i) => bubble(m, i))}
                </div>
              )}

              {isThinking && thinkingDot()}

              {/* AI suggestion — click to copy into main textbox */}
              {!isThinking && discussSuggestion && (
                <div className="flex flex-col gap-2 bg-white border border-indigo-100 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-widest">Suggested version</p>
                  <p className="text-sm text-slate-800 leading-relaxed">{discussSuggestion}</p>
                  <button
                    onClick={useDiscussSuggestion}
                    className="self-end text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-1.5 transition-colors"
                  >
                    Use Suggestion ←
                  </button>
                </div>
              )}

              {/* Reply input */}
              {!isThinking && (
                <div className="flex gap-2">
                  <textarea
                    value={discussReply}
                    onChange={e => setDiscussReply(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        sendDiscussReply();
                      }
                    }}
                    placeholder={discussMessages.length === 0 ? "What's your idea?" : 'Reply…'}
                    rows={2}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  />
                  <button
                    onClick={sendDiscussReply}
                    disabled={!discussReply.trim()}
                    className="text-xs font-semibold bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl px-3 self-end py-2 transition-colors"
                  >Send</button>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs text-rose-600">{error}</p>}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
