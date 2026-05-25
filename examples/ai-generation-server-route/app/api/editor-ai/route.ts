// app/api/editor-ai/route.ts
// Complete AI endpoint implementation for @allebrum/page-editor
//
// Supports all AI actions defined by AiEditorRequest.
// API keys are loaded from environment variables only — never from client props.

import { NextRequest, NextResponse } from 'next/server';
import type { AiEditorRequest, AiEditorResponse } from '@allebrum/page-editor';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ─── Main handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth check (implement your own)
  // const session = await getServerSession(authOptions);
  // if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Rate limiting (implement with Upstash, Redis, etc.)
  // const { success } = await ratelimit.limit(session.user.id);
  // if (!success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'AI not configured on this server' },
      { status: 503 },
    );
  }

  let body: AiEditorRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const response = await routeAiAction(body);
    return NextResponse.json(response);
  } catch (err) {
    console.error('[editor-ai] Error:', err);
    return NextResponse.json(
      { error: 'AI request failed. Please try again.' },
      { status: 500 },
    );
  }
}

// ─── Action router ────────────────────────────────────────────────────────

async function routeAiAction(req: AiEditorRequest): Promise<AiEditorResponse> {
  switch (req.action) {
    case 'improve-writing':
      return improveWriting(req);
    case 'summarize':
      return summarize(req);
    case 'expand':
      return expand(req);
    case 'translate':
      return translate(req);
    case 'generate-alt-text':
      return generateAltText(req);
    case 'generate-section':
      return generateSection(req);
    case 'generate-image-prompt':
      return generateImagePrompt(req);
    default:
      throw new Error(`Unsupported action: ${(req as AiEditorRequest).action}`);
  }
}

// ─── Action implementations ────────────────────────────────────────────────

async function improveWriting(req: AiEditorRequest): Promise<AiEditorResponse> {
  const text = req.selection?.text ?? '';
  const result = await chat(
    'You are a professional writing assistant. Improve the writing quality while preserving the original meaning and tone. Return only the improved text.',
    `Improve this text:\n\n${text}`,
  );
  return { type: 'replace-selection', content: result };
}

async function summarize(req: AiEditorRequest): Promise<AiEditorResponse> {
  const text = req.selection?.text ?? '';
  const result = await chat(
    'You are a concise summarizer. Create a brief, clear summary of the provided text.',
    `Summarize this:\n\n${text}`,
  );
  return { type: 'replace-selection', content: result };
}

async function expand(req: AiEditorRequest): Promise<AiEditorResponse> {
  const text = req.selection?.text ?? '';
  const result = await chat(
    'You are a skilled writer. Expand the provided text with more detail, examples, and context while maintaining the original tone.',
    `Expand this text:\n\n${text}`,
  );
  return { type: 'replace-selection', content: result };
}

async function translate(req: AiEditorRequest): Promise<AiEditorResponse> {
  const text = req.selection?.text ?? '';
  const locale = req.locale ?? 'English';
  const result = await chat(
    `You are a professional translator. Translate text accurately to ${locale}.`,
    `Translate to ${locale}:\n\n${text}`,
  );
  return { type: 'replace-selection', content: result };
}

async function generateAltText(req: AiEditorRequest): Promise<AiEditorResponse> {
  const context = req.instructions ?? '';
  const result = await chat(
    'You are an accessibility expert. Write concise, descriptive alt text for images. Focus on what is visually meaningful.',
    `Write alt text for an image. Context: ${context}`,
    60,
  );
  return { type: 'replace-selection', content: result };
}

async function generateSection(req: AiEditorRequest): Promise<AiEditorResponse> {
  const instructions = req.instructions ?? '';
  const result = await chat(
    'You are a content writer. Generate a well-structured content section based on the instructions. Return clean, professional prose.',
    `Generate a content section: ${instructions}`,
    500,
  );
  return { type: 'insert-after', content: result };
}

async function generateImagePrompt(req: AiEditorRequest): Promise<AiEditorResponse> {
  const text = req.selection?.text ?? req.instructions ?? '';
  const result = await chat(
    'You are a creative director. Generate a detailed image generation prompt based on the provided text content.',
    `Generate an image prompt for this content:\n\n${text}`,
    150,
  );
  return { type: 'open-preview', content: result };
}

// ─── OpenAI helper ────────────────────────────────────────────────────────

async function chat(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 500,
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${error}`);
  }

  const data = await res.json();
  return data.choices[0]?.message?.content?.trim() ?? '';
}
