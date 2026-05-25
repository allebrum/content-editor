# Example: AI Generation Server Route

A complete Next.js API route implementing the `@allebrum/page-editor` AI endpoint contract.

## What this shows

- All AI actions supported by the editor
- How to route to different AI models per action
- Streaming response support for long content
- Security: auth check before processing
- Rate limiting pattern
- Error handling

## Setup

```bash
OPENAI_API_KEY=sk-... npm run dev
```

The editor sends requests to `POST /api/editor-ai` with an `AiEditorRequest` body.
Your route handles the action and returns an `AiEditorResponse`.
