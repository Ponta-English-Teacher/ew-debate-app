import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerClient } from '@/lib/supabase/server';
import { mergeSettings } from '@/lib/sessionSettings';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { sessionId, postContent, motionText, parentContent, label } = await req.json();

  if (!sessionId || !postContent || !motionText) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Feature flag check
  const db = createServerClient();
  const { data: sess } = await db
    .from('ewd_sessions')
    .select('settings')
    .eq('id', sessionId)
    .single();
  const settings = mergeSettings(sess?.settings);
  if (!settings.feature_explain_post) {
    return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
  }

  const parentBlock = parentContent
    ? `\nThis post is a reply to:\n"${parentContent}"\n`
    : '';
  const labelBlock = label
    ? `\nContribution type selected by the writer: ${label}`
    : '';

  const prompt = `You are helping a student understand a post in a classroom debate.

Motion: "${motionText}"
${labelBlock}

Post to explain:
"${postContent}"
${parentBlock}
Your job is to help other students understand what this post means.

You are NOT evaluating whether the argument is correct or strong.
You are NOT improving the argument.
You are NOT arguing back.
You are simply explaining what the writer meant.

If the post uses reference words like "this", "it", "that", "I disagree", interpret them using the context provided.
If the post is a reply, explain it in relation to the post it is responding to.

Return ONLY valid JSON — no other text, no code fences:
{
  "simpleExplanation": "A clear 1-2 sentence explanation of what the writer is saying, in simple English.",
  "mainPoint": "The core argument or question in one short sentence.",
  "keyPhrases": ["phrase 1", "phrase 2"]
}

Rules:
- simpleExplanation: 1-2 sentences. Clear. Use vocabulary suitable for high school students.
- mainPoint: 1 sentence maximum.
- keyPhrases: 2-4 short phrases or words from the post that carry the core meaning. Return [] if none are notable.
- Do NOT change the writer's position.
- Do NOT say whether you agree or disagree.
- Do NOT evaluate the quality of the argument.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 300,
    });
    const raw = completion.choices[0].message.content ?? '';
    const stripped = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(stripped);
    return NextResponse.json({
      simpleExplanation: parsed.simpleExplanation ?? '',
      mainPoint: parsed.mainPoint ?? '',
      keyPhrases: Array.isArray(parsed.keyPhrases) ? parsed.keyPhrases : [],
    });
  } catch {
    return NextResponse.json({ error: 'AI unavailable' }, { status: 502 });
  }
}
