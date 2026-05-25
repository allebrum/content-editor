import type { AiConfig, AiEditorRequest, AiEditorResponse } from '../schema/types';

export async function callAiEndpoint(
  config: AiConfig,
  request: AiEditorRequest,
): Promise<AiEditorResponse> {
  const res = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.headers ?? {}),
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    throw new Error(`AI endpoint returned ${res.status}: ${await res.text()}`);
  }

  return res.json() as Promise<AiEditorResponse>;
}
