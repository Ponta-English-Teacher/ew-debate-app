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

  // Direct-reply count per argument — used to gauge which questions
  // actually generated discussion, not just which got reaction taps.
  const replyCountMap = new Map<string, number>();
  for (const a of argList) {
    if (a.parent_id) replyCountMap.set(a.parent_id, (replyCountMap.get(a.parent_id) ?? 0) + 1);
  }
  const replyCountOf = (id: string) => replyCountMap.get(id) ?? 0;

  const proArgs      = argList.filter(a => getLabel(a.response_type) === 'PRO').slice(0, 6);
  const conArgs      = argList.filter(a => getLabel(a.response_type) === 'CON').slice(0, 6);
  const allQuestions = argList.filter(a => getLabel(a.response_type) === 'QUESTION');
  const questions     = allQuestions.slice(0, 4);

  // Key questions: ranked by how much discussion they generated (reply
  // count), not by reaction taps — a question "touches a central issue"
  // when classmates engaged with it, not just liked it.
  const keyQuestions = [...allQuestions]
    .sort((a, b) =>
      replyCountOf(b.id) - replyCountOf(a.id) ||
      (b.strong_count ?? 0) - (a.strong_count ?? 0) ||
      (b.interesting_count ?? 0) - (a.interesting_count ?? 0)
    )
    .filter(q => replyCountOf(q.id) > 0)
    .slice(0, 2);

  const topProArg = proArgs[0] ?? null;
  const topConArg = conArgs[0] ?? null;

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

  const formatReactions = (a: { id: string; strong_count: number | null; interesting_count: number | null }) => {
    const replies = replyCountOf(a.id);
    return `💪${a.strong_count ?? 0} 💡${a.interesting_count ?? 0}${replies > 0 ? ` ↩${replies}` : ''}`;
  };

  const proSection = proArgs.length > 0
    ? proArgs.map((a, i) => `${i + 1}. [${formatReactions(a)}] "${a.content}"`).join('\n')
    : '(No PRO arguments submitted yet)';

  const conSection = conArgs.length > 0
    ? conArgs.map((a, i) => `${i + 1}. [${formatReactions(a)}] "${a.content}"`).join('\n')
    : '(No CON arguments submitted yet)';

  const questionSection = questions.length > 0
    ? questions.map((a, i) => `${i + 1}. "${a.content}"`).join('\n')
    : '';

  const keyQuestionSection = keyQuestions.length > 0
    ? keyQuestions.map((a, i) => `${i + 1}. [↩${replyCountOf(a.id)} replies] "${a.content}"`).join('\n')
    : '';

  const replySection = replyPairs.length > 0
    ? replyPairs.map(p => `- [${p.parentLabel}] "${p.parentContent}" → [${p.replyLabel}] "${p.replyContent}"`).join('\n')
    : '';

  const prompt = buildPrompt({
    motionText: motion.motion_text,
    proSection,
    conSection,
    questionSection,
    keyQuestionSection,
    replySection,
    topProClaim: topProArg ? `"${topProArg.content}" (💪${topProArg.strong_count ?? 0})` : null,
    topConClaim: topConArg ? `"${topConArg.content}" (💪${topConArg.strong_count ?? 0})` : null,
  });

  let rawJson = '';
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2800,
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
  motionText:         string;
  proSection:         string;
  conSection:         string;
  questionSection:    string;
  keyQuestionSection: string;
  replySection:       string;
  topProClaim:        string | null;
  topConClaim:        string | null;
}

function buildPrompt({
  motionText, proSection, conSection, questionSection, keyQuestionSection, replySection, topProClaim, topConClaim,
}: PromptParts): string {
  const questionBlock = questionSection
    ? `\nQuestions raised by students (background context — clash points in the discussion):\n${questionSection}`
    : '';

  const keyQuestionBlock = keyQuestionSection
    ? `\nKey questions — these generated real back-and-forth discussion among students (↩ = reply count):\n${keyQuestionSection}\nIf one of these is clearly relevant to the central clash, name it explicitly in chair_transition_2 (see Section 5). If none are relevant, do not force a mention.`
    : '';

  const replyBlock = replySection
    ? `\nDiscussion exchanges (showing how the class debated these ideas):\n${replySection}`
    : '';

  const proRebuttalTarget = topConClaim
    ? `The single strongest opposing argument you must respond to is: ${topConClaim}.`
    : 'Respond to the strongest CON argument available above.';

  const conRebuttalTarget = topProClaim
    ? `The single strongest opposing argument you must respond to is: ${topProClaim}.`
    : 'Respond to the strongest PRO argument available above.';

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
Each contribution below is tagged with classmate signals:
  💪 = how many classmates judged the argument's reasoning strong, regardless of which side they personally support
  💡 = how many classmates found it an interesting or novel point
  ↩  = how many direct replies it received (a sign it became a real discussion point, shown only when greater than zero)
Arguments are listed highest 💪 first (ties broken by 💡) — this is the class's quality judgement, not a popularity vote on the position.

PRO arguments — supporting the motion (highest 💪 listed first):
${proSection}

CON arguments — opposing the motion (highest 💪 listed first):
${conSection}
${questionBlock}
${keyQuestionBlock}
${replyBlock}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEFORE WRITING — identify the clash points (internal analysis only, do not include in output):
Look at the PRO and CON contributions. What are the 1–3 real tensions that emerged between what PRO students and CON students said?
Name them as clash types, for example: Safety vs. Innovation, Individual Choice vs. Collective Benefit, Equality vs. Freedom, Rights vs. Responsibility.
These clash points should drive the rebuttal sections and the Chairperson's transitions. Do not invent clash points that are not visible in the contributions.

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

SECTION 3 — chair_transition_1 — Chairperson Transition (2–3 sentences, speaking as the Chairperson, not a speaker — do not say "Thank you, Chairperson")
In one sentence, summarise the PRO speaker's main point from Section 2 — name the specific claim, not a generic restatement.
In one sentence, note the tension this raises (you do not yet know the CON response, so you may frame this as anticipation, e.g. "It remains to be seen how the CON team will respond to this.").
Close with: "I now invite the first speaker for the CON team."

SECTION 4 — con_1 — First CON Speaker
Open with: "Thank you, Chairperson."
Your first sentence must directly reference a specific claim the PRO speaker made in Section 2:
  Pattern: "The PRO team has argued that [specific PRO claim from Section 2]. However, [challenge drawn from CON student contributions]."
Then organise and express the CON student arguments. Approximately 1–2 sentences per distinct argument.
Every challenge must come from the CON contributions above. Present highest-💪 arguments most prominently.

SECTION 5 — chair_transition_2 — Chairperson Transition (3–4 sentences, speaking as the Chairperson — do not say "Thank you, Chairperson")
In one sentence, summarise the CON speaker's main point from Section 4 — name the specific claim.
Now that both opening speeches are complete, state the central clash between the two sides in one sentence (use the clash type you identified above, e.g. "This debate centres on a tension between [X] and [Y].").
${keyQuestionSection ? 'If a key question listed above is clearly relevant to this clash, include one sentence naming it, in the form: "An important question raised in the discussion was [question, lightly paraphrased]." If none of the key questions are clearly relevant, skip this — do not force an unrelated mention.' : 'No key questions were available from this discussion — do not invent one.'}
Close with: "We now move to rebuttals, beginning with the PRO team."

SECTION 6 — pro_rebuttal — PRO Rebuttal
Open with: "Thank you, Chairperson."
${proRebuttalTarget}
Your first sentence must accurately state that specific opposing claim, then explain — specifically, not just contrastively — why or how it falls short, using language like "however this overlooks...", "but this fails to consider...", "yet this assumes...".
Do not introduce new PRO arguments — work only with PRO arguments already raised.
End by returning to why the PRO position holds, drawing on the strongest PRO contributions.

SECTION 7 — chair_transition_3 — Chairperson Transition (2–3 sentences, speaking as the Chairperson — do not say "Thank you, Chairperson")
In one sentence, summarise the PRO rebuttal's main counter-point from Section 6.
In one sentence, reaffirm the central clash now that PRO has responded.
Close with: "We now turn to the CON team for their rebuttal."

SECTION 8 — con_rebuttal — CON Rebuttal
Open with: "Thank you, Chairperson."
${conRebuttalTarget}
Your first sentence must accurately state that specific opposing claim, then explain — specifically, not just contrastively — why or how it falls short, using language like "however this overlooks...", "but this fails to consider...", "yet this assumes...".
Do not introduce new CON arguments — work only with CON arguments already raised.
End with a clear statement of why the CON position holds, drawing on the strongest CON contributions.

SECTION 9 — chairperson_close (4–5 sentences)
Name the central clash explicitly, not a generic summary: "This debate centred on a tension between [X] and [Y]."
Summarise the actual final positions: "The PRO team maintained that [brief summary]. The CON team countered that [brief summary]."
If a key question named in Section 5 remains genuinely unresolved by either rebuttal, you may note it once more as a question worth continued thought — otherwise omit this.
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
    {"role": "chairperson_open",    "text": "..."},
    {"role": "pro_1",               "text": "..."},
    {"role": "chair_transition_1",  "text": "..."},
    {"role": "con_1",               "text": "..."},
    {"role": "chair_transition_2",  "text": "..."},
    {"role": "pro_rebuttal",        "text": "..."},
    {"role": "chair_transition_3",  "text": "..."},
    {"role": "con_rebuttal",        "text": "..."},
    {"role": "chairperson_close",   "text": "..."}
  ]
}`;
}
