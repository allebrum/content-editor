export type { AiEditorRequest, AiEditorResponse, AiEditorAction, AiEditorResponseType } from '../schema/types';

/**
 * Server-side contract documentation for the AI endpoint.
 *
 * The consuming app implements POST /api/editor-ai (or any endpoint).
 * The package calls this endpoint; API keys never touch the client.
 *
 * Example Next.js implementation:
 *
 * ```ts
 * // app/api/editor-ai/route.ts
 * import { NextRequest, NextResponse } from 'next/server';
 * import type { AiEditorRequest, AiEditorResponse } from '@allebrum/page-editor';
 * import OpenAI from 'openai';
 *
 * const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 *
 * export async function POST(req: NextRequest) {
 *   const body: AiEditorRequest = await req.json();
 *
 *   // Auth check here
 *   // Rate limit here
 *
 *   const text = body.selection?.text ?? '';
 *
 *   const systemPrompt = 'You are a helpful content editor assistant.';
 *   const userPrompt = buildPrompt(body.action, text, body.instructions);
 *
 *   const completion = await openai.chat.completions.create({
 *     model: 'gpt-4o',
 *     messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
 *   });
 *
 *   const content = completion.choices[0].message.content ?? '';
 *
 *   return NextResponse.json({
 *     type: 'replace-selection',
 *     content,
 *   } satisfies AiEditorResponse);
 * }
 *
 * function buildPrompt(action: string, text: string, instructions?: string): string {
 *   const prompts: Record<string, string> = {
 *     'improve-writing': `Improve the following text for clarity and flow:\n\n${text}`,
 *     'make-shorter': `Make this shorter while keeping the key meaning:\n\n${text}`,
 *     'make-longer': `Expand this with more detail:\n\n${text}`,
 *     'fix-grammar': `Fix grammar and spelling:\n\n${text}`,
 *     'summarize': `Summarize in 1-2 sentences:\n\n${text}`,
 *   };
 *   return (prompts[action] ?? `${instructions ?? action}:\n\n${text}`);
 * }
 * ```
 */
