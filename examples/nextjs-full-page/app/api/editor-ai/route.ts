// app/api/editor-ai/route.ts
// AI endpoint — keeps provider keys server-side, never exposed to the browser
import { NextRequest, NextResponse } from 'next/server';
import type { AiEditorRequest, AiEditorResponse } from '@allebrum/page-editor';

// Load your AI provider key from environment variables only
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: NextRequest) {
  // TODO: Add your own auth check here
  // const session = await getServerSession();
  // if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body: AiEditorRequest = await req.json();

  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
  }

  try {
    const response = await handleAiAction(body);
    return NextResponse.json(response);
  } catch (err) {
    console.error('AI action error:', err);
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}

async function handleAiAction(req: AiEditorRequest): Promise<AiEditorResponse> {
  const { action, selection, instructions } = req;

  const systemPrompt = 'You are a helpful writing assistant for a page editor.';

  let userPrompt = '';
  switch (action) {
    case 'improve-writing':
      userPrompt = `Improve the writing of the following text. Return only the improved text, no explanation:\n\n${selection?.text}`;
      break;
    case 'summarize':
      userPrompt = `Summarize the following text concisely:\n\n${selection?.text}`;
      break;
    case 'expand':
      userPrompt = `Expand the following text with more detail:\n\n${selection?.text}`;
      break;
    case 'translate':
      userPrompt = `Translate the following text to ${req.locale ?? 'English'}:\n\n${selection?.text}`;
      break;
    case 'generate-alt-text':
      userPrompt = `Write a concise, descriptive alt text for an image. Context: ${instructions ?? 'No context provided.'}`;
      break;
    default:
      throw new Error(`Unsupported action: ${action}`);
  }

  // Call OpenAI (replace with your preferred provider)
  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1000,
    }),
  });

  if (!openaiRes.ok) {
    throw new Error(`OpenAI error: ${openaiRes.status}`);
  }

  const data = await openaiRes.json();
  const content = data.choices[0]?.message?.content ?? '';

  return {
    type: 'replace-selection',
    content,
  };
}
