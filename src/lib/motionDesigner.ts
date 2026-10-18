// AI Motion Designer — shared types, validation limits and prompt.
// Used by /api/ai/motion-designer (server) and the MotionDesigner panel (client).

// Change the model here to switch the Motion Designer (e.g. to 'gpt-4o').
export const MOTION_DESIGNER_MODEL = 'gpt-4o-mini';

export const STAGES = ['elementary', 'junior_high', 'high_school', 'university', 'adult'] as const;
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;

export type Stage = typeof STAGES[number];
export type Cefr = typeof CEFR_LEVELS[number];

export const STAGE_LABELS: Record<Stage, string> = {
  elementary:  'Elementary school',
  junior_high: 'Junior high school',
  high_school: 'High school',
  university:  'University',
  adult:       'Adult learners',
};

export interface ClassProfile {
  stage: Stage | null;
  cefr:  Cefr | null;
}

export interface DesignerMessage {
  role:    'user' | 'assistant';
  content: string;
}

export interface MotionCheck {
  ok:   boolean;
  note: string;
}

export interface MotionProposal {
  motion:  string;
  pro:     string[];
  con:     string[];
  checks: {
    clear:       MotionCheck;
    relevant:    MotionCheck;
    language:    MotionCheck;
    balanced:    MotionCheck;
    interaction: MotionCheck;
  };
  caution: string | null;
}

export interface DesignerReply {
  message:   string;
  profile:   ClassProfile;
  topic:     string | null;
  proposals: MotionProposal[];
}

// Shape returned by the model; the server turns comment + question into `message`.
export interface RawDesignerReply extends Omit<DesignerReply, 'message'> {
  comment:  string;
  question: string;
}

export interface DesignerContext {
  topic?:           string;
  existingMotions?: string[];
}

// ── Limits (cost control) ────────────────────────────────────────────────────

export const MAX_MESSAGES_IN_REQUEST = 40;   // client must start a new conversation after this
export const MAX_MESSAGE_CHARS       = 2000;
export const HISTORY_SENT_TO_MODEL   = 12;   // first teacher message + most recent turns
export const MAX_OUTPUT_TOKENS       = 900;

export const CHECK_LABELS: Record<keyof MotionProposal['checks'], string> = {
  clear:       'Clear',
  relevant:    'Relevant',
  language:    'Level',
  balanced:    'Balanced',
  interaction: 'Discussion',
};

// Keep the teacher's first message (their goal) plus the most recent turns.
export function trimHistory(messages: DesignerMessage[]): DesignerMessage[] {
  if (messages.length <= HISTORY_SENT_TO_MODEL) return messages;
  return [messages[0], ...messages.slice(-(HISTORY_SENT_TO_MODEL - 1))];
}

// ── Prompt ───────────────────────────────────────────────────────────────────

export function buildSystemPrompt(profile: ClassProfile, context: DesignerContext): string {
  const stage = profile.stage ? STAGE_LABELS[profile.stage] : 'not known yet';
  const cefr  = profile.cefr ?? 'not known yet';

  const contextLines: string[] = [];
  if (context.topic) contextLines.push(`Session topic: ${context.topic}`);
  if (context.existingMotions?.length) {
    contextLines.push('Motions already in this session (do not repeat them):');
    context.existingMotions.forEach((m, i) => contextLines.push(`  ${i + 1}. ${m}`));
  }

  return `You are an experienced English-language teacher and debate coach acting as a teaching partner for a teacher who is preparing a classroom debate. Together you develop debate motions through conversation. You do not just generate lists of topics: you help the teacher think, clarify vague ideas, and judge what will work with their students.

## Current class profile (set by the teacher; treat it as current even if it changed earlier in the conversation)
- Student age / school stage: ${stage}
- English proficiency (CEFR): ${cefr}
${contextLines.length ? '\n## Session context\n' + contextLines.join('\n') + '\n' : ''}
## Conversation rules
1. ONE question per reply, at the end. If you want to offer options, put them inside that single question ("Should the rule come from schools, or from parents?"). Never write a second question sentence.
2. Understand the teacher's goal. If the idea is vague (e.g. "technology", "dating"), clarify the most important missing point first: who decides, where or when it applies, which group is affected, or what exactly would change. Do not accept a vague idea as a motion: when the teacher gives only a broad topic (one or two words, or no clear issue), propose NOTHING yet (proposals = []) and ask your clarification question.
3. Never ask for something the profile already gives. If the school stage is unknown and matters, ask about it. If the CEFR level is still unknown after your first proposal, your next question should ask about it, so you can check the wording.
4. Do not interrogate. Once the issue is clear (usually after one or two clarifications), propose motions and keep refining.
5. When proposing, offer 1 or 2 motions, then ask ONE follow-up question that helps the teacher improve the motion. It must address exactly one of these:
   - scope or specificity (e.g. "Should it cover all homework, or only essays?")
   - who is affected (e.g. "Should the rule apply to all grades, or only first-year students?")
   - where or when it applies (e.g. "Should the rule apply only at school, or also outside school?")
   - exceptions or conditions (e.g. "Should there be an exception for emergencies?")
   - who decides (e.g. "Should the school decide, or parents?")
   - PRO/CON balance: if one side looks much easier to argue, ask about a change of scope that would make it fairer.
   Questions you must NEVER ask:
   - which side the motion should take ("allowing or banning?", "benefits or risks?", "beneficial or harmful?"): every motion is debated from both sides;
   - about reasons, arguments, effects or impacts, or whether the motion should mention or consider them (e.g. "Should the motion mention comfort?", "Should the motion consider the impact on families?"): those belong in the debate, not in the motion;
   - about a detail you have just decided in the motion (e.g. after narrowing it to first-year students, do not ask whether it should apply only to first-year students);
   - the motion itself turned into a question ("Should schools ban phones?");
   - anything already asked, or already answered by the teacher;
   - generic questions ("Which do you prefer?", "Do these work for you?", "Would you like to refine them?");
   - two questions joined in one sentence ("…, and should…?").
   Ask about the most important point that is still open for a classroom debate with THESE students. Avoid unusual edge cases, and stay within the teacher's students (e.g. do not ask about middle school students when the class is a high school class, and do not offer the students' own school stage as an alternative, e.g. "only elementary students?" for an elementary class).
6. Two proposals must be genuinely different motions (different scope, rule or angle). NEVER propose a motion together with its opposite (e.g. "Schools should ban X" and "Schools should allow X"): one motion already has a PRO side and a CON side.
7. When the teacher refines an idea, revise the current motion so it fully reflects what the teacher just said (e.g. if they say "also outside school", the motion must cover outside school), rather than starting over. Rewrite the whole motion so it stays logical: never just append a phrase that contradicts the rest (e.g. not "during school hours, both inside and outside school").
8. Quick requests:
   - "Easier": make the ENGLISH easier (more common words, simpler structure, more concrete wording). Keep the same topic and the same intellectual depth.
   - "More challenging": make the wording more precise or nuanced (conditions, qualifiers, more abstract or topic-specific vocabulary) and/or the issue more complex, appropriate to the students' age.
   - "Narrower": narrow the scope (a specific place, time, group or rule) so students can use concrete examples.
   - "Other ideas": offer NEW motions on the same teaching goal that are different from every motion already proposed in this conversation.
9. You only suggest. You never create sessions or publish anything; the teacher decides.

## Age and English level are independent
- AGE / SCHOOL STAGE decides the issue: how mature and serious it is, how familiar it is from students' own lives, how deep the arguments can go (personal → school → society → policy), and whether it is sensitive for that age.
- CEFR LEVEL decides the wording: vocabulary, grammar and how abstract the language is. There are NO word limits. Prioritise clarity, comprehensibility, appropriate vocabulary and precision.
  - A1: very common words, one simple "should" sentence, concrete nouns.
  - A2: everyday vocabulary; a simple time or place condition is fine.
  - B1: some abstract nouns and common topic words are fine.
  - B2: precise, nuanced wording with conditions or qualifiers.
- A low English level must NEVER make the topic childish. A1 teenagers and adults can debate serious, intellectually meaningful questions; express them in accessible English instead. Example: junior high school, A1 → "Schools should ban smartphones." High school, B2 → "Schools should ban smartphones during the school day, including breaks."
- Avoid idioms and ambiguous words. Make key terms precise when that helps (e.g. "during school hours", "at school").

## How to write a motion
- Use a policy motion: "[who] should [do what]" (e.g. "Junior high schools should prohibit students from dating."), unless the teacher asks for another type.
- State the policy only. Do NOT add reasons or purposes ("…to protect students", "…to ensure skills", "…due to its negative effects"): they argue for one side.
- Use neutral words. Avoid loaded words that favour one side (e.g. "junk food", "unfair", "harmful", "waste").

## Motion quality (check every proposed motion critically)
- clear: specific, unambiguous, one issue, a policy statement that can be clearly supported or opposed.
- relevant: familiar and meaningful for students of this age.
- language: understandable at this CEFR level; name any key word that may be difficult. If the CEFR level is unknown, set ok=false and say the level is needed to judge.
- balanced: reasonable, roughly equal arguments exist for both sides AND the wording itself is neutral.
- interaction: likely to produce examples, questions, disagreement and real responses between students.
Be an honest critic: a ✓ must be earned. Set ok=false whenever there is a real weakness, explain it in the note, and fix it in your next proposal.

## Sensitive topics
Do not refuse ordinary school topics. For students under 18, topics such as dating and relationships, appearance and body, family money, religion or politics ALWAYS need a short "caution" with classroom advice (e.g. keep the debate about rules, not about individual students). Otherwise caution is null.

## Language
- Write everything in English: "comment", "question", "motion", "pro", "con", check notes and "caution".
- "topic" is a short English label (2–6 words) for the session topic, or null if you have not proposed a motion yet.

## Output fields
- comment: 1–3 short sentences of plain text (no markdown, no lists, NO questions). Do not repeat the motions or the PRO/CON points: they are shown on separate cards.
- question: exactly ONE question sentence (see rules 1, 3 and 5).
- profile: the class profile. Keep the values above, but update stage or cefr if the teacher states them anywhere in the conversation (e.g. "junior high school students" → junior_high; "around A2" → A2). Use null for unknown.
- proposals: [] when you are only asking a clarification question; otherwise 1–2 motions, each with 2–3 short PRO points and 2–3 short CON points.`;
}

// JSON Schema for OpenAI structured outputs (strict mode)
const checkSchema = {
  type: 'object',
  properties: {
    ok:   { type: 'boolean', description: 'true only if there is no real weakness for this criterion; false otherwise.' },
    note: { type: 'string', description: 'One short, specific sentence explaining the judgement.' },
  },
  required: ['ok', 'note'],
  additionalProperties: false,
};

export const DESIGNER_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    comment: { type: 'string', description: 'Plain text, 1-3 sentences, in English. No questions, no markdown, no lists.' },
    question: { type: 'string', description: 'Exactly one question sentence in English: a missing class detail, or a specific point about the motion (scope, place, time, who decides, exceptions). Never "Which do you prefer?" or "Do these work?".' },
    profile: {
      type: 'object',
      properties: {
        stage: { type: ['string', 'null'], enum: [...STAGES, null] },
        cefr:  { type: ['string', 'null'], enum: [...CEFR_LEVELS, null] },
      },
      required: ['stage', 'cefr'],
      additionalProperties: false,
    },
    topic: { type: ['string', 'null'] },
    proposals: {
      type: 'array',
      description: '0-2 motions. Two motions must be genuinely different (scope, rule or angle), never a motion and its opposite.',
      items: {
        type: 'object',
        properties: {
          motion: { type: 'string' },
          pro:    { type: 'array', items: { type: 'string' } },
          con:    { type: 'array', items: { type: 'string' } },
          checks: {
            type: 'object',
            properties: {
              clear:       checkSchema,
              relevant:    checkSchema,
              language:    checkSchema,
              balanced:    checkSchema,
              interaction: checkSchema,
            },
            required: ['clear', 'relevant', 'language', 'balanced', 'interaction'],
            additionalProperties: false,
          },
          caution: { type: ['string', 'null'], description: 'Required (not null) for students under 18 when the topic involves dating/relationships, appearance/body, family money, religion or politics: short classroom advice. Otherwise null.' },
        },
        required: ['motion', 'pro', 'con', 'checks', 'caution'],
        additionalProperties: false,
      },
    },
  },
  required: ['comment', 'question', 'profile', 'topic', 'proposals'],
  additionalProperties: false,
} as const;

// Summarise an assistant reply for the conversation history, so the model
// remembers which motions it proposed without resending the full cards.
export function replyToHistory(reply: DesignerReply): string {
  if (!reply.proposals.length) return reply.message;
  const list = reply.proposals.map((p, i) => `${i + 1}. "${p.motion}"`).join('\n');
  return `${reply.message}\n\n[Motions proposed:\n${list}]`;
}

// ── Motion transfer into the Create Session form ─────────────────────────────

export const MAX_MOTIONS = 3;

// Fill the first empty field, else add a field (up to 3), else replace the
// field the teacher chose. Never overwrites text unless replaceIndex is given.
export function placeMotion(
  fields: string[],
  motion: string,
  replaceIndex?: number,
): { fields: string[]; message: string } {
  const existing = fields.findIndex(f => f.trim().toLowerCase() === motion.trim().toLowerCase());
  if (existing !== -1) {
    return { fields, message: `This motion is already in Motion ${existing + 1}.` };
  }
  if (replaceIndex !== undefined && replaceIndex >= 0 && replaceIndex < fields.length) {
    return {
      fields: fields.map((f, i) => (i === replaceIndex ? motion : f)),
      message: `Replaced Motion ${replaceIndex + 1}.`,
    };
  }
  const empty = fields.findIndex(f => !f.trim());
  if (empty !== -1) {
    return { fields: fields.map((f, i) => (i === empty ? motion : f)), message: `Added as Motion ${empty + 1}.` };
  }
  if (fields.length < MAX_MOTIONS) {
    return { fields: [...fields, motion], message: `Added as Motion ${fields.length + 1}.` };
  }
  return { fields, message: 'All 3 motion fields are filled. Choose one to replace.' };
}


// ── Reply post-processing (enforces rules the model may ignore) ──────────────

// Split only where a sentence end is followed by a space, so "e.g.," stays intact
const SENTENCE_SPLIT = /(?<=[.!?])\s+/;
const isQuestion = (s: string) => /\?\s*$/.test(s);

// Comment without question sentences, followed by exactly one question.
export function composeMessage(comment: string, question: string): string {
  const statements = comment.split(SENTENCE_SPLIT).filter(s => s.trim() && !isQuestion(s.trim())).join(' ').trim();
  // Keep the question up to its first question mark (abbreviations like "e.g." can't break it)
  const q = question.trim().match(/^[^?]*\?/)?.[0].trim() ?? question.trim();
  return [statements, q].filter(Boolean).join('\n\n');
}

const POLARITY_WORDS = new Set([
  'should', 'not', 'no', 'ban', 'banned', 'allow', 'allowed', 'prohibit', 'prohibited', 'permit', 'permitted',
  'keep', 'abolish', 'remove', 'maintain', 'require', 'required', 'stop', 'continue', 'end', 'forbid', 'restrict',
  'be', 'to', 'from', 'the', 'a', 'an', 'their', 'students', 'using', 'use', 'have', 'let',
]);
function contentWords(motion: string): Set<string> {
  return new Set(motion.toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(w => w && !POLARITY_WORDS.has(w)));
}

// True when two motions are the same proposition with opposite polarity
// (e.g. "Schools should ban smartphones." / "Schools should allow smartphones.").
export function isMirrorPair(a: string, b: string): boolean {
  const A = contentWords(a), B = contentWords(b);
  if (!A.size || !B.size) return false;
  const shared = [...A].filter(w => B.has(w)).length;
  return shared / Math.max(A.size, B.size) >= 0.8;
}

// ── Rule-based safeguards on top of the AI's own checks ──────────────────────
// The model tends to mark every check as passed, so problems that can be
// detected reliably are added here.

const REASON_CLAUSE = /\b(as it|as they|because|since|so that|due to|for the sake of|in order to|to (ensure|protect|prevent|improve|promote|uphold|maintain|preserve|reduce|increase|avoid))\b/i;
const SENSITIVE = /\b(dating|to date|go on dates?|boyfriends?|girlfriends?|relationships?|romantic|romance|make-?up|hairstyles?|hair colou?r|appearance|body image|weight|religions?|religious|politics|political|elections?|family income|poverty)\b/i;
const ADULT_STAGES: Stage[] = ['university', 'adult'];

export function applyGuards(reply: DesignerReply): DesignerReply {
  const proposals = reply.proposals.map(p => {
    const checks = { ...p.checks };
    if (!reply.profile.cefr) {
      checks.language = {
        ok: false,
        note: 'Set the English level (CEFR) so the wording can be checked.',
      };
    }
    if (REASON_CLAUSE.test(p.motion)) {
      const note = 'The motion includes a reason, which helps one side. State only the policy.';
      checks.clear = { ok: false, note };
      checks.balanced = { ok: false, note };
    }
    let caution = p.caution;
    const minor = !reply.profile.stage || !ADULT_STAGES.includes(reply.profile.stage);
    if (!caution && minor && SENSITIVE.test(`${p.motion} ${reply.topic ?? ''}`)) {
      caution = 'This topic can be personal for students under 18. Keep the debate about rules and policies, not about individual students or their own experiences.';
    }
    return { ...p, checks, caution };
  });
  return { ...reply, proposals };
}

// Remove stray JSON fragments the model occasionally leaves at the end of a list item.
export function cleanItem(text: string): string {
  return text.replace(/\s*[\]\[{}]+,?\s*$/, '').trim();
}

// ── "Other ideas" must not repeat earlier motions ────────────────────────────

const OTHER_IDEAS_REQUEST = /other (motion )?ideas|different motions/i;

export function isOtherIdeasRequest(text: string): boolean {
  return OTHER_IDEAS_REQUEST.test(text);
}

// Motions already proposed, read from the history format written by replyToHistory()
export function previousMotions(messages: DesignerMessage[]): string[] {
  const found: string[] = [];
  for (const m of messages) {
    if (m.role !== 'assistant') continue;
    const block = m.content.split('[Motions proposed:')[1];
    if (!block) continue;
    for (const match of block.matchAll(/^\s*\d+\.\s*"(.+)"\s*\]?\s*$/gm)) found.push(match[1].trim());
  }
  return found;
}

export function sameMotion(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return norm(a) === norm(b);
}

// ── Reply review (problems the model may ignore despite the prompt) ──────────

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
const QUESTION_FILLER = new Set(['should', 'the', 'a', 'an', 'this', 'that', 'it', 'motion', 'rule', 'rules', 'debate', 'apply', 'applies', 'to', 'or', 'and', 'only', 'just', 'also', 'all', 'some', 'any', 'be', 'for', 'of', 'in', 'on', 'at', 'like', 'such', 'as', 'there', 'include', 'focus', 'we', 'you', 'your', 'certain', 'specific']);
// Overlap of meaningful words only, for spotting the same question asked in different words
function questionOverlap(a: string, b: string): { ratio: number; shared: number } {
  const A = new Set(words(a).filter(w => !QUESTION_FILLER.has(w))), B = new Set(words(b).filter(w => !QUESTION_FILLER.has(w)));
  if (!A.size || !B.size) return { ratio: 0, shared: 0 };
  const shared = [...A].filter(w => B.has(w)).length;
  return { ratio: shared / Math.min(A.size, B.size), shared };
}
function overlap(a: string, b: string): number {
  const A = new Set(words(a)), B = new Set(words(b));
  if (!A.size || !B.size) return 0;
  return [...A].filter(w => B.has(w)).length / Math.max(A.size, B.size);
}

// The question part of an assistant message in the history (last paragraph before the motions list)
export function previousQuestions(messages: DesignerMessage[]): string[] {
  return messages
    .filter(m => m.role === 'assistant')
    .map(m => m.content.split('[Motions proposed:')[0].trim().split('\n\n').pop()?.trim() ?? '')
    .filter(q => q.endsWith('?'));
}

// Asking for reasons/arguments, or to put them into the motion ("an exception for medical reasons" is fine)
const ASKS_FOR_REASONS = /\b(mention|consider|address|discuss|reflect)\w*\b[^?]*\b(impacts?|effects?|affects?|affected|consequences?|how (this|it))\b|\bwhy\b|\bwhat\b[^?]*\b(reasons?|arguments?)\b|\b(mention|include|add|state|list|specify|explain|give)\b[^?]*\b(reasons?|arguments?|benefits?|advantages?)\b|\b(reasons?|arguments?)\s+(for|against|why|behind)\b/i;
// Asking which side the motion should take: a choice between a positive and a negative framing
const ASKS_WHICH_SIDE = /\b(benefits?|advantages?|positives?|beneficial|helpful)\b[^?]*\bor\b[^?]*\b(risks?|harms?|drawbacks?|disadvantages?|negatives?|harmful)\b|\b(risks?|harms?|drawbacks?|disadvantages?|negatives?|harmful)\b[^?]*\bor\b[^?]*\b(benefits?|advantages?|positives?|beneficial|helpful)\b|\b(pros and cons|benefits and (drawbacks|risks|challenges)|advantages and disadvantages|positives and negatives)\b|\b(about|focus on|be)\b[^?]*\b(allow\w*|ban\w*|permit\w*)\b[^?]*\bor\b[^?]*\b(ban\w*|allow\w*|restrict\w*|permit\w*|prohibit\w*)\b/i;
const TWO_QUESTIONS = /,?\s+and\s+(should|will|would|do|does|is|are|can|could)\s/i;

// Returns the problems found in a reply (empty when it is fine)
export function reviewReply(reply: DesignerReply, messages: DesignerMessage[]): string[] {
  const problems: string[] = [];
  const question = reply.message.split('\n\n').pop() ?? '';
  const lastTeacher = messages[messages.length - 1]?.content ?? '';

  if (question.endsWith('?')) {
    if (ASKS_FOR_REASONS.test(question)) problems.push('Your question asks about reasons or arguments. Ask about scope, who is affected, where/when, exceptions or who decides instead.');
    if (ASKS_WHICH_SIDE.test(question)) problems.push('Your question asks which side the motion should take (e.g. allow vs ban, benefits vs risks). Both sides are debated anyway; ask about scope, who is affected, where/when, exceptions or who decides instead.');
    if (TWO_QUESTIONS.test(question)) problems.push('Your question joins two questions. Ask only one.');
    if (reply.proposals.some(p => overlap(question, p.motion) >= 0.75)) problems.push('Your question just repeats the motion. Ask something that would improve it.');
    if (previousQuestions(messages).some(q => overlap(question, q) >= 0.7 || (({ ratio, shared }) => ratio >= 0.75 && shared >= 3)(questionOverlap(question, q)))) problems.push('You already asked this question. Ask about a different aspect.');
  }
  // Asking whether to undo the detail just added (e.g. "only first-year students, or all grades?")
  const earlierForDetail = previousMotions(messages);
  if (question.endsWith('?') && earlierForDetail.length && !isOtherIdeasRequest(lastTeacher) && /\b(only|all|rather than|instead)\b/i.test(question)) {
    const before = new Set(earlierForDetail.flatMap(words));
    const added = new Set(reply.proposals.flatMap(p => words(p.motion)).filter(w => w.length > 3 && !before.has(w) && !POLARITY_WORDS.has(w)));
    if (new Set(words(question).filter(w => added.has(w))).size >= 2) problems.push('Your question asks about the detail you just added to the motion. Ask about a different point that is still open.');
  }
  if (reply.proposals.some(p => REASON_CLAUSE.test(p.motion))) problems.push('A motion includes a reason or purpose (e.g. "to ensure…", "due to…"). State only the policy.');

  // A typed answer from the teacher should change the motion
  const earlier = previousMotions(messages);
  if (reply.proposals.length && earlier.length && !isOtherIdeasRequest(lastTeacher)
      && reply.proposals.every(p => earlier.some(e => sameMotion(e, p.motion)))) {
    problems.push(`Your motions are unchanged. Revise them so they reflect the teacher's latest answer: "${lastTeacher.slice(0, 200)}".`);
  }
  return problems;
}

// After the retry: never show a bad question or a motion with a built-in reason
export function dropRemainingProblems(reply: DesignerReply, messages: DesignerMessage[]): DesignerReply {
  const problems = reviewReply(reply, messages);
  let message = reply.message;
  const questionProblem = problems.some(p => p.startsWith('Your question') || p.startsWith('You already asked'));
  if (questionProblem) message = message.split('\n\n').slice(0, -1).join('\n\n');
  const clean = reply.proposals.filter(p => !REASON_CLAUSE.test(p.motion));
  return { ...reply, message, proposals: clean.length ? clean : reply.proposals };
}
