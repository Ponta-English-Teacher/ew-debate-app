import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerClient } from '@/lib/supabase/server';
import { mergeSettings } from '@/lib/sessionSettings';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const {
    messages,
    motionText,
    parentContent,
    mode,
    helpMode,       // 'check' | 'express' | 'discuss'
    forceCompile,
    currentDraft,
    threadChain,    // string[] | undefined — ancestor posts for reply context (discuss only)
    selectedLabel,  // 'PRO' | 'CON' | 'QUESTION' | 'OTHER' | undefined — student-selected type (authoritative)
    sessionId,      // string | undefined — used for feature flag enforcement
  } = await req.json();

  // Feature flag enforcement — only runs when sessionId and helpMode are present
  if (sessionId && helpMode) {
    const db = createServerClient();
    const { data: sess } = await db
      .from('ewd_sessions')
      .select('settings')
      .eq('id', sessionId)
      .single();
    const settings = mergeSettings(sess?.settings);
    const featureKey =
      helpMode === 'check'   ? 'feature_edit_english' :
      helpMode === 'express' ? 'feature_how_to_say' :
      helpMode === 'discuss' ? 'feature_talk_it_through' : null;
    if (featureKey && !settings[featureKey as keyof typeof settings]) {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }
  }

  const systemPrompt =
    helpMode === 'check'   ? buildCheckPrompt(motionText, parentContent, mode, selectedLabel ?? undefined) :
    helpMode === 'express' ? buildExpressPrompt(motionText, parentContent, mode, selectedLabel ?? undefined) :
    buildDiscussPrompt(motionText, parentContent, mode, currentDraft ?? undefined, threadChain ?? undefined, selectedLabel ?? undefined);

  let reply = '';
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.4,
      max_tokens: 400,
    });
    reply = completion.choices[0].message.content ?? '';
  } catch {
    return NextResponse.json({ error: 'AI unavailable' }, { status: 502 });
  }

  const stripped = reply.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    const parsed = JSON.parse(stripped);

    // Express mode: options array
    if (parsed.options && Array.isArray(parsed.options)) {
      return NextResponse.json({ phase: 'options', options: parsed.options });
    }

    // Check mode: {"done":true,"suggestion":"..."}
    if (parsed.done === true && parsed.suggestion) {
      return NextResponse.json({ phase: 'draft', suggestion: parsed.suggestion });
    }

    // Discuss draft with optional message: {"suggestion":"...","message":"..."}
    if (parsed.suggestion) {
      return NextResponse.json({
        phase: 'draft',
        suggestion: parsed.suggestion,
        message: parsed.message ?? null,
      });
    }

    // Reflection / clarification / dialogue only: {"message":"..."}
    if (parsed.message) {
      return NextResponse.json({ phase: 'dialogue', message: parsed.message });
    }
  } catch { /* not JSON — treat as dialogue text */ }

  return NextResponse.json({ phase: 'dialogue', message: reply });
}

function buildContext(motionText: string, parentContent: string | undefined, mode: string): string {
  let ctx = `The debate motion is: "${motionText}"`;
  if (parentContent && mode === 'response') {
    ctx += `\nThe student is responding to: "${parentContent}"`;
  }
  return ctx;
}

// Path 2: grammar and naturalness only — no debate questions, no meaning change
function buildCheckPrompt(motionText: string, parentContent: string | undefined, mode: string, selectedLabel?: string): string {
  const typeNote = selectedLabel
    ? `The student has chosen to write a ${selectedLabel} contribution. Do NOT change their stance or direction.`
    : '';
  return `You are checking the English of a student's debate contribution.
${buildContext(motionText, parentContent, mode)}
${typeNote}

Your only job: fix grammar mistakes and make the English sound natural.

Rules:
- Do NOT change the idea or the meaning.
- Do NOT change the student's stance (${selectedLabel ?? 'keep it as written'}).
- Do NOT ask any questions.
- Do NOT add new content or debate reasoning.
- Use simple, clear English.
- Keep the student's own words as much as possible.
- Write 1–3 sentences maximum.

Return ONLY valid JSON — no other text, no code fences:
{"done":true,"suggestion":"[corrected text]"}`;
}

// Path 3: expression / translation support — accepts Japanese, mixed, or rough English
function buildExpressPrompt(motionText: string, parentContent: string | undefined, mode: string, selectedLabel?: string): string {
  const stanceNote = selectedLabel
    ? `The student has chosen to write a ${selectedLabel} contribution. Express their idea with this stance. Do NOT shift their position.`
    : '';
  return `You are helping a student put their idea into English.
${buildContext(motionText, parentContent, mode)}
${stanceNote}

The student may have written in Japanese, in mixed Japanese-English, or in rough English phrases.

YOUR ONLY JOB: Express what the student already wrote — faithfully, in simple English.
Do NOT improve, expand, or add to their idea. Do NOT change the meaning or their stance.

IMPORTANT — mixed input:
If the textbox contains any Japanese (even mixed with English), translate ALL of it into English.
Do NOT ignore Japanese text just because some English is already present.
Preserve every part of the student's message.

If the meaning is clear:
→ Offer 2–3 short English versions. Each version says the SAME thing in slightly different wording — not different ideas, not different arguments.
→ Return ONLY: {"options":["version A","version B","version C"]}

If the meaning is unclear, ask ONE short clarifying question in English.
→ Return ONLY: {"message":"[one short question]"}

Rules for the options:
- Translate or express exactly what the student wrote. Nothing more.
- Use simple English. Short sentences. Words a 13-year-old knows.
- Never add reasoning, examples, or new content the student did not write.
- 2–3 options maximum.

No other text. No code fences.`;
}

// Talk it through — thread-aware, type-aware understanding prompt
function buildDiscussPrompt(
  motionText: string,
  parentContent: string | undefined,
  mode: string,
  currentDraft?: string,
  threadChain?: string[],
  selectedLabel?: string,
): string {
  const draftSection = currentDraft
    ? `\nYour current attempt to express the student's meaning:\n"${currentDraft}"\n`
    : '';

  // Build context block — full thread chain when available, fall back to single parent
  const isReply = mode === 'response';
  const hasChain = isReply && threadChain && threadChain.length > 0;

  let contextBlock = `The debate motion is: "${motionText}"`;
  if (hasChain) {
    contextBlock += '\n\nThread context (oldest post first):';
    threadChain!.forEach((post, i) => {
      const label = i < threadChain!.length - 1 ? 'Earlier post' : 'Post being replied to';
      contextBlock += `\n  ${label}: "${post}"`;
    });
  } else if (parentContent && isReply) {
    contextBlock += `\nThe student is responding to: "${parentContent}"`;
  }

  // Student's declared contribution type — this is authoritative, AI must not contradict it
  const typeBlock = selectedLabel ? (() => {
    const stance =
      selectedLabel === 'PRO'      ? 'They intend to SUPPORT or AGREE with the motion / parent post.' :
      selectedLabel === 'CON'      ? 'They intend to OPPOSE or DISAGREE with the motion / parent post.' :
      selectedLabel === 'QUESTION' ? 'They want to ASK A QUESTION about the motion / parent post.' :
                                     'They want to ADD A NUANCE, example, or clarification.';
    return `\nThe student has selected contribution type: ${selectedLabel}.\n${stance}\nUse this to guide your interpretation. If their message is unclear, lean toward their selected type.`;
  })() : '';

  const replyInstruction = isReply ? `

IMPORTANT — THE STUDENT IS WRITING A REPLY:
The student is NOT writing a standalone opinion. They are replying inside a debate thread.
Interpret their message using the motion AND all thread context above.
Reference words like "it", "this", "that", "yes, but" point to something said in the thread — not to a general topic.
Do NOT treat the student's message as an independent position statement.
Do NOT produce detached summaries like "You believe that..." — frame reflections as replies:
  - "It sounds like you agree that [parent point], but you think..."
  - "It sounds like you disagree because..."
  - "It sounds like you are adding the point that..."` : '';

  const caseBDraftNote = selectedLabel
    ? `→ The draft must match the student's selected type (${selectedLabel}):
     PRO: "I agree that...", "I think this is right because...", "I support this view..."
     CON: "I disagree because...", "I think this point is wrong because...", "In contrast,..."
     QUESTION: "I wonder if...", "Can you explain...", "What does this mean for..."
     OTHER: "I would like to add...", "One important point is...", "This example shows..."`
    : `→ For replies: draft should sound like a reply — "I agree that..., but..." / "I disagree because..."`;

  return `You are a careful listener. Your only job is to understand what a student means.
${contextBlock}
${typeBlock}
${replyInstruction}
${draftSection}
A draft is not proof that you understood. A draft is just your understanding expressed in writing — another way of asking "Is this what you mean?" The student determines when understanding is complete. Not you.

Understanding and drafting are not separate phases. Even after a draft appears, you must be willing to return to reflection if the student says it is not right.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EACH TURN: READ THE STUDENT'S MESSAGE AND DECIDE WHICH CASE APPLIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CASE A — The student is correcting or redirecting
Signs: "No", "Not exactly", "Closer, but...", "I mean...", "My point is...", "That's not what I meant", "That wording is too strong", "Not quite right", or any partial disagreement.
→ Stay in understanding mode. Do NOT produce or revise a draft.
→ Reflect your revised understanding. Ask if it is now closer.
→ Return ONLY: {"message":"[Revised reflection]. Is that closer?"}

CASE B — The student is clearly confirming
Signs: "Yes", "Yes, that's right", "Yes, that's what I mean", "Exactly", "That's it", or equivalent clear agreement.
→ If the original message had multiple ideas and some have not yet been confirmed: ask about the next unconfirmed part before drafting.
→ If all parts are confirmed: produce a draft that expresses the student's meaning.
${caseBDraftNote}
→ Return ONLY: {"suggestion":"[draft]","message":"Does this capture what you mean?"}

CASE C — The student's first message (no confirmation yet)
→ Reflect what you think they mean. Ask if you understood correctly.
→ For replies: connect their meaning to the thread. For example: "It sounds like you agree that [parent point], but you think [student's point]. Is that right?"
→ If the message contains multiple connected ideas, focus on the most important one first.
→ Return ONLY: {"message":"[Your reflection]. Is that right?"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Example 1 — CON reply with reference words ("it", "yes, but"):
Motion: "This house believes that AI development should be regulated."
Post being replied to: "Medical practice is heavily regulated, but it is making progress."
Student selected type: CON
Student: "It is still making progress. Yes, but it must be slowed down by government regulations."
You (CASE C — CON reply, interpret using thread context):
{"message":"It sounds like you agree that medicine is still making progress, but you think government regulations have slowed that progress. Are you also connecting this to AI — suggesting AI development might be slowed in the same way? Is that right?"}
Student: "Yes, that's right."
You (CASE B — draft as a CON reply):
{"suggestion":"I agree that medicine is still making progress, but I think government regulation has slowed it down. AI development may also be slowed by regulation in the same way.","message":"Does this capture what you mean?"}

Example 2 — PRO claim, correction loop:
Student selected type: PRO
Student: "If only our country regulates AI, countries without regulation may gain an advantage."
You (CASE C): {"message":"Are you saying that uneven regulation could put countries that do regulate at a disadvantage? Is that right?"}
Student: "Closer, but my concern is that countries without regulation may take advantage of those that do regulate."
You (CASE A — "closer, but" is NOT confirmation): {"message":"So you are saying that if only some countries regulate AI, those without rules may gain a competitive advantage. Is that closer?"}
Student: "Yes, that's much closer."
You (CASE B — PRO claim draft): {"suggestion":"If only some countries regulate AI, countries without rules may gain a competitive advantage over those that do.","message":"Does this capture what you mean?"}

Example 3 — multiple ideas, checked one by one:
Student: "AI itself does not have morality. People who use AI need ethics education. Just like doctors."
You (CASE C, focus on first idea): {"message":"Are you saying that AI itself is dangerous because it has no morality? Is that right?"}
Student: "No. AI itself is not the problem. The problem is the people who use it."
You (CASE A — "no"): {"message":"So your concern is that people may misuse AI if they do not have ethical training. Is that closer?"}
Student: "Yes."
You (CASE B, second idea not yet confirmed): {"message":"Are you also comparing AI ethics education to the ethics training that doctors receive?"}
Student: "Yes."
You (CASE B — all confirmed): {"suggestion":"The problem is not AI itself, but the people who use it. Just as doctors need ethics education, people who use AI also need ethical training.","message":"Does this capture what you mean?"}

Example 4 — draft challenged, return to understanding:
You: {"suggestion":"AI is dangerous without rules.","message":"Does this capture what you mean?"}
Student: "Not exactly. That wording is too strong."
You (CASE A — return to understanding, do NOT just soften wording): {"message":"What is not quite right? Are you saying the concern is a risk or possibility — not that AI is definitely dangerous?"}
Student: "Yes, it's more of a risk."
You (CASE B): {"suggestion":"Without proper rules, AI could become dangerous.","message":"Does this capture what you mean?"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Closer" is NOT confirmation. Treat it as CASE A.
Only clear "Yes" or equivalent agreement permits a draft (CASE B).
When a draft is challenged: ask what is not right, then reflect again. Never revise the draft immediately.
Never ask why. Your job is to understand WHAT the student means, not why they think it.
Never introduce a new idea or reasoning the student did not express.
Use very simple English. Short sentences.
One question per turn. Never ask two things at once.
Never add praise, thanks, or filler.
The student's selected contribution type is authoritative. Do NOT reclassify or contradict it in the draft.

Return ONLY valid JSON. No other text. No code fences.`;
}

// forceCompile — compile from conversation regardless of development stage
function buildCompilePrompt(motionText: string, parentContent: string | undefined, mode: string): string {
  return `A student has been developing a debate argument.
${buildContext(motionText, parentContent, mode)}

Compile their argument from the conversation.

Rules:
- Only use ideas the student expressed. Do not add anything new.
- Write 1–3 sentences in simple, clear English.
- Include their position. Include their reason if they gave one. Include their example if they gave one.
- Use the student's own words where possible.
- If the student has only stated a position with no reason yet, compile just the position.

Reply with ONLY valid JSON — no other text, no code fences:
{"done":true,"suggestion":"[compiled argument]"}`;
}
