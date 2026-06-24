import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerClient } from '@/lib/supabase/server';
import { getLabel } from '@/lib/debateLabels';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  const auth = req.headers.get('authorization');
  const expected = process.env.NEXT_PUBLIC_MODERATOR_PASSWORD;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { motionId } = body;
  if (!motionId) {
    return NextResponse.json({ error: 'motionId is required' }, { status: 400 });
  }

  const db = createServerClient();

  const { data: motion, error: motionErr } = await db
    .from('ewd_motions')
    .select('id, motion_text')
    .eq('id', motionId)
    .eq('session_id', sessionId)
    .single();

  if (motionErr || !motion) {
    return NextResponse.json({ error: 'Motion not found' }, { status: 404 });
  }

  const { data: rows, error: argsErr } = await db
    .from('ewd_arguments_with_votes')
    .select('id, parent_id, response_type, content, strong_count, interesting_count')
    .eq('session_id', sessionId)
    .eq('motion_id', motionId)
    .order('strong_count', { ascending: false })
    .order('interesting_count', { ascending: false });

  if (argsErr) {
    return NextResponse.json({ error: argsErr.message }, { status: 500 });
  }

  const argList = rows ?? [];

  const proArgs   = argList.filter(a => getLabel(a.response_type) === 'PRO').slice(0, 6);
  const conArgs   = argList.filter(a => getLabel(a.response_type) === 'CON').slice(0, 6);
  const questions = argList.filter(a => getLabel(a.response_type) === 'QUESTION').slice(0, 4);

  const replyPairs = argList
    .filter(a => a.parent_id !== null)
    .slice(0, 5)
    .map(reply => {
      const parent = argList.find(a => a.id === reply.parent_id);
      if (!parent) return null;
      return {
        parentLabel:   getLabel(parent.response_type),
        parentContent: parent.content,
        replyLabel:    getLabel(reply.response_type),
        replyContent:  reply.content,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const warning =
    proArgs.length < 2 || conArgs.length < 2
      ? 'This model debate may be limited because there are not many student posts yet.'
      : undefined;

  const formatReactions = (a: { strong_count: number | null; interesting_count: number | null }) =>
    `💪${a.strong_count ?? 0} 💡${a.interesting_count ?? 0}`;

  const proSection = proArgs.length > 0
    ? proArgs.map((a, i) => `${i + 1}. [${formatReactions(a)}] "${a.content}"`).join('\n')
    : '(No PRO arguments submitted yet)';

  const conSection = conArgs.length > 0
    ? conArgs.map((a, i) => `${i + 1}. [${formatReactions(a)}] "${a.content}"`).join('\n')
    : '(No CON arguments submitted yet)';

  const questionSection = questions.length > 0
    ? questions.map((a, i) => `${i + 1}. "${a.content}"`).join('\n')
    : '';

  const replySection = replyPairs.length > 0
    ? replyPairs.map(p => `- [${p.parentLabel}] "${p.parentContent}" → [${p.replyLabel}] "${p.replyContent}"`).join('\n')
    : '';

  const prompt = buildPrompt({ motionText: motion.motion_text, proSection, conSection, questionSection, replySection });

  let rawJson = '';
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    });
    rawJson = completion.choices[0].message.content ?? '';
  } catch {
    return NextResponse.json({ error: 'AI unavailable' }, { status: 502 });
  }

  const stripped = rawJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  let parsed: { segments: Array<{ role: string; text: string }> };
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response. Please try again.' }, { status: 500 });
  }

  if (!Array.isArray(parsed?.segments)) {
    return NextResponse.json({ error: 'Unexpected AI response format. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({
    motionText:  motion.motion_text,
    segments:    parsed.segments,
    generatedAt: new Date().toISOString(),
    postCount:   argList.length,
    proCount:    proArgs.length,
    conCount:    conArgs.length,
    warning,
  });
}

interface PromptParts {
  motionText:      string;
  proSection:      string;
  conSection:      string;
  questionSection: string;
  replySection:    string;
}

function buildPrompt({ motionText, proSection, conSection, questionSection, replySection }: PromptParts): string {
  const questionBlock = questionSection
    ? `\nQuestions raised by students (treat these as live clash points in the debate):\n${questionSection}`
    : '';

  const replyBlock = replySection
    ? `\nDiscussion exchanges (showing how the class debated these ideas):\n${replySection}`
    : '';

  return `You are a debate moderator and editor — not a debate participant.

Your job is to take the student contributions below and shape them into a formal debate script.
You are organising and elevating what the students already said — not creating a debate for them.

Your role:
  ALLOWED — combine similar student arguments, paraphrase for clarity, improve language, group related ideas, identify clash points, create rebuttal structure, add formal debate framing and chairperson transitions
  NOT ALLOWED — invent new claims, add new evidence, introduce examples students did not raise, generate arguments on behalf of the class

The quality and depth of the generated debate must reflect the quality and depth of the student discussion.
If students contributed many strong arguments, the debate should be rich. If they contributed only a few, the debate should be shorter and simpler.
A debate faithfully based on two student arguments is better than a longer debate padded with invented ones.

Faithfulness test: for every substantive claim in your script, ask "Which student contribution above supports this?" If you cannot point to one, remove it.
Three-class test: if a different class discussed the same motion but raised different arguments, the resulting debate should sound noticeably different. If it would sound the same, you are inventing rather than organising.

Motion: "${motionText}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STUDENT CONTRIBUTIONS — your only source material
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Each contribution below is tagged with two classmate reaction counts:
  💪 = how many classmates judged the argument's reasoning strong, regardless of which side they personally support
  💡 = how many classmates found it an interesting or novel point
Arguments are listed highest 💪 first (ties broken by 💡) — this is the class's quality judgement, not a popularity vote on the position.

PRO arguments — supporting the motion (highest 💪 listed first):
${proSection}

CON arguments — opposing the motion (highest 💪 listed first):
${conSection}
${questionBlock}
${replyBlock}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEFORE WRITING — identify the clash points (internal analysis only, do not include in output):
Look at the PRO and CON contributions. What are the 1–3 real tensions that emerged between what PRO students and CON students said?
Name them as clash types, for example: Safety vs. Innovation, Individual Choice vs. Collective Benefit, Equality vs. Freedom, Rights vs. Responsibility.
These clash points should drive the rebuttal sections. Do not invent clash points that are not visible in the contributions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 1 — chairperson_open (3–4 sentences, always the same structure)
  "Ladies and gentlemen, welcome to today's debate."
  "The motion before us is: [state the full motion]."
  "I now invite the first speaker for the PRO team to present their case."

SECTION 2 — pro_1 — First PRO Speaker
Open with: "Thank you, Chairperson."
Organise and express the PRO student arguments above in clear, confident debate language.
Cover each distinct PRO argument. Write approximately 1–2 sentences per argument.
Present highest-💪 arguments most prominently. Speak in first person.
Write only as many sentences as the PRO contributions support — do not add invented points.

SECTION 3 — con_1 — First CON Speaker
Open with: "Thank you, Chairperson."
Your first sentence must directly reference a specific claim the PRO speaker made in Section 2:
  Pattern: "The PRO team has argued that [specific PRO claim from Section 2]. However, [challenge drawn from CON student contributions]."
Then organise and express the CON student arguments. Approximately 1–2 sentences per distinct argument.
Every challenge must come from the CON contributions above. Present highest-💪 arguments most prominently.

SECTION 4 — pro_rebuttal — PRO Rebuttal
Open with: "Thank you, Chairperson."
Focus on the main clash point that emerged between the two sides in this discussion.
Your first sentence must name a specific argument the CON speaker made in Section 3:
  Pattern: "The CON team argues that [specific CON claim from Section 3]. Yet [response drawn from PRO student contributions]."
Do not introduce new PRO arguments — work only with PRO arguments already raised.
End by returning to why the PRO position holds, drawing on the strongest PRO contributions.

SECTION 5 — con_rebuttal — CON Rebuttal
Open with: "Thank you, Chairperson."
Focus on the main clash point that emerged between the two sides in this discussion.
Your first sentence must name a specific point the PRO rebuttal made in Section 4:
  Pattern: "The PRO team insists that [specific PRO rebuttal claim from Section 4]. But [counter drawn from CON student contributions]."
Do not introduce new CON arguments — work only with CON arguments already raised.
End with a clear statement of why the CON position holds, drawing on the strongest CON contributions.

SECTION 6 — chairperson_close (3–4 sentences)
Summarise the actual clash that emerged in this discussion — not a generic summary.
  "We have heard the PRO team argue that [brief summary of actual PRO case]. The CON team has challenged this, arguing that [brief summary of actual CON case]."
  "Thank you to all our speakers."
  "We invite all listeners to consider these arguments and reach their own conclusion."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LANGUAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRO / CON labels only (not "Proposition" / "Opposition")
Direct engagement language: "However", "Yet", "Despite this", "On the contrary", "This overlooks", "But this fails to consider"
Continuous prose — no bullet points, no numbering, no headers, no markdown
Short, clear sentences — this will be read aloud
Language accessible to high school students

Students should hear the result and think: "Those are our ideas, expressed more clearly."
They should not think: "The AI wrote a debate for us."

Return ONLY valid JSON — no other text, no code fences:
{
  "segments": [
    {"role": "chairperson_open", "text": "..."},
    {"role": "pro_1",            "text": "..."},
    {"role": "con_1",            "text": "..."},
    {"role": "pro_rebuttal",     "text": "..."},
    {"role": "con_rebuttal",     "text": "..."},
    {"role": "chairperson_close","text": "..."}
  ]
}`;
}
