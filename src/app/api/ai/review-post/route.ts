import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { postContent, motionText, parentContent, label } = await req.json();

  if (!postContent || !motionText) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const parentBlock = parentContent
    ? `\nThis post is a reply to:\n"${parentContent}"\n`
    : '';
  const labelBlock = label
    ? `\nThe student's stance/type for this post: ${label}. Do NOT change this stance.`
    : '';

  const prompt = `You are helping a Japanese university student (English level A2–B1) improve a post they wrote in a classroom debate. You are reviewing the CONTENT — clarity, reasoning, and persuasiveness. This is NOT a grammar check.

Motion: "${motionText}"
${labelBlock}

Post to review:
"${postContent}"
${parentBlock}
Rules:
- Do NOT change the student's stance or position.
- Do NOT add a new argument, reason, or example the student did not write.
- Do NOT make the argument more advanced than A2–B1 level. Use short sentences and simple, common vocabulary.
- The improved version must express the SAME idea, just clearer and more convincing.
- Keep the improved version close in length to the original (roughly 1-3 sentences).

Return ONLY valid JSON — no other text, no code fences:
{
  "good": "1 short sentence on what is already good about this argument.",
  "couldBeClearer": "1 short sentence on what could be clearer or stronger.",
  "improvedVersion": "A stronger version of the SAME argument, same stance, same A2-B1 vocabulary level, 1-3 sentences."
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 400,
    });
    const raw = completion.choices[0].message.content ?? '';
    const stripped = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(stripped);
    return NextResponse.json({
      good:            parsed.good            ?? '',
      couldBeClearer:  parsed.couldBeClearer  ?? '',
      improvedVersion: parsed.improvedVersion ?? '',
    });
  } catch {
    return NextResponse.json({ error: 'AI unavailable' }, { status: 502 });
  }
}
