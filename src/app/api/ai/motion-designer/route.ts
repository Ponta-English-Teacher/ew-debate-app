import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireTeacher } from '@/lib/teacherAuthServer';
import {
  CEFR_LEVELS,
  DESIGNER_RESPONSE_SCHEMA,
  MAX_MESSAGE_CHARS,
  MAX_MESSAGES_IN_REQUEST,
  MAX_OUTPUT_TOKENS,
  MOTION_DESIGNER_MODEL,
  STAGES,
  applyGuards,
  buildSystemPrompt,
  cleanItem,
  composeMessage,
  isMirrorPair,
  dropRemainingProblems,
  isOtherIdeasRequest,
  reviewReply,
  previousMotions,
  sameMotion,
  trimHistory,
  type ClassProfile,
  type DesignerContext,
  type DesignerMessage,
  type DesignerReply,
  type RawDesignerReply,
  type MotionProposal,
} from '@/lib/motionDesigner';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /api/ai/motion-designer — teacher only.
// Body: { messages: [{role, content}], profile: {stage, cefr}, context?: {topic, existingMotions} }
// Returns: { message, profile, topic, proposals }
export async function POST(req: NextRequest) {
  const denied = requireTeacher(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = parseRequest(body);
  if (typeof parsed === 'string') {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }
  const { messages, profile, context } = parsed;

  const chat: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(profile, context) },
    ...trimHistory(messages),
  ];

  let reply: DesignerReply;
  try {
    reply = sanitizeReply(await complete(chat), profile);
    // "Other ideas" must give new motions. Ask once more, then drop repeats.
    const earlier = previousMotions(messages);
    const isRepeat = (m: string) => earlier.some(e => sameMotion(e, m));
    if (isOtherIdeasRequest(messages[messages.length - 1].content) && reply.proposals.some(p => isRepeat(p.motion))) {
      const retry = sanitizeReply(await complete([
        ...chat,
        { role: 'system', content: `These motions were already proposed; give different ones:\n${earlier.map(m => `- ${m}`).join('\n')}` },
      ]), profile);
      const fresh = retry.proposals.filter(p => !isRepeat(p.motion));
      if (fresh.length) reply = { ...retry, proposals: fresh };
    }
    // Review the question and motions; ask once more with specific feedback if needed
    const problems = reviewReply(reply, messages);
    if (problems.length) {
      const retry = sanitizeReply(await complete([
        ...chat,
        { role: 'assistant', content: JSON.stringify({ comment: reply.message, proposals: reply.proposals.map(p => p.motion) }) },
        { role: 'system', content: `Rewrite your reply and fix these problems:\n${problems.map(p => `- ${p}`).join('\n')}` },
      ]), profile);
      if (!(isOtherIdeasRequest(messages[messages.length - 1].content) && retry.proposals.some(p => isRepeat(p.motion)))) {
        reply = retry;
      }
    }
    reply = dropRemainingProblems(reply, messages);
  } catch {
    return NextResponse.json({ error: 'AI unavailable' }, { status: 502 });
  }

  return NextResponse.json(applyGuards(reply));
}

async function complete(chat: OpenAI.ChatCompletionMessageParam[]): Promise<RawDesignerReply> {
  // The model occasionally returns plain text (in `refusal`) instead of the JSON reply; retry once.
  for (let attempt = 0; ; attempt++) {
    const completion = await openai.chat.completions.create({
      model: MOTION_DESIGNER_MODEL,
      messages: chat,
      temperature: 0.5,
      max_tokens: MAX_OUTPUT_TOKENS,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'motion_designer_reply', strict: true, schema: DESIGNER_RESPONSE_SCHEMA },
      },
    });
    try {
      return JSON.parse(completion.choices[0].message.content ?? '');
    } catch (err) {
      if (attempt >= 1) throw err;
    }
  }
}

function parseRequest(body: unknown):
  | { messages: DesignerMessage[]; profile: ClassProfile; context: DesignerContext }
  | string {
  if (!body || typeof body !== 'object') return 'Invalid request body';
  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.messages) || b.messages.length === 0) return 'messages is required';
  if (b.messages.length > MAX_MESSAGES_IN_REQUEST) return 'Conversation is too long. Please start a new one.';

  const messages: DesignerMessage[] = [];
  for (const m of b.messages) {
    if (!m || typeof m !== 'object') return 'Invalid message';
    const { role, content } = m as Record<string, unknown>;
    if (role !== 'user' && role !== 'assistant') return 'Invalid message role';
    if (typeof content !== 'string' || !content.trim()) return 'Invalid message content';
    if (role === 'user' && content.length > MAX_MESSAGE_CHARS) return 'Message is too long';
    messages.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS) });
  }
  if (messages[messages.length - 1].role !== 'user') return 'Last message must be from the teacher';

  const p = (b.profile ?? {}) as Record<string, unknown>;
  const stage = p.stage ?? null;
  const cefr = p.cefr ?? null;
  if (stage !== null && !STAGES.includes(stage as never)) return 'Invalid stage';
  if (cefr !== null && !CEFR_LEVELS.includes(cefr as never)) return 'Invalid CEFR level';

  const c = (b.context ?? {}) as Record<string, unknown>;
  const context: DesignerContext = {};
  if (typeof c.topic === 'string' && c.topic.trim()) context.topic = c.topic.trim().slice(0, 200);
  if (Array.isArray(c.existingMotions)) {
    context.existingMotions = c.existingMotions
      .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
      .slice(0, 3)
      .map(m => m.trim().slice(0, 300));
  }

  return { messages, profile: { stage, cefr } as ClassProfile, context };
}

function sanitizeReply(data: RawDesignerReply, fallback: ClassProfile): DesignerReply {
  const stage = STAGES.includes(data.profile?.stage as never) ? data.profile.stage : fallback.stage;
  const cefr = CEFR_LEVELS.includes(data.profile?.cefr as never) ? data.profile.cefr : fallback.cefr;
  const proposals: MotionProposal[] = (Array.isArray(data.proposals) ? data.proposals : [])
    .filter(p => typeof p?.motion === 'string' && p.motion.trim())
    .slice(0, 2)
    .map(p => ({ ...p, motion: p.motion.trim(), pro: p.pro.slice(0, 3).map(cleanItem), con: p.con.slice(0, 3).map(cleanItem) }));
  // A motion and its opposite are one debate, not two options: keep the first.
  if (proposals.length === 2 && isMirrorPair(proposals[0].motion, proposals[1].motion)) proposals.pop();

  return {
    message: composeMessage(String(data.comment ?? ''), String(data.question ?? '')),
    profile: { stage, cefr },
    topic: typeof data.topic === 'string' && data.topic.trim() ? data.topic.trim() : null,
    proposals,
  };
}
