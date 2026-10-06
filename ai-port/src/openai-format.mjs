import { randomUUID } from 'node:crypto';

/** Error carrying an HTTP status and whether the router may try the next provider. */
export class ProviderError extends Error {
  constructor(message, { status = 502, retryable = true, body = '' } = {}) {
    super(message);
    this.status = status;
    this.retryable = retryable;
    this.body = body;
  }
}

/** Statuses that mean "this provider can't serve it now; another one might". */
export function isRetryableStatus(status) {
  return status === 401 || status === 402 || status === 403 || status === 404
    || status === 408 || status === 409 || status === 422 || status === 429 || status >= 500;
}

export function completionId() {
  return `chatcmpl-${randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

export function buildCompletion({ id = completionId(), model, content, finishReason = 'stop', usage, toolCalls }) {
  const message = { role: 'assistant', content: content ?? null };
  if (toolCalls?.length) message.tool_calls = toolCalls;
  return {
    id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message, finish_reason: finishReason, logprobs: null }],
    usage: usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

export function chunk({ id, model, delta = {}, finishReason = null, usage }) {
  const out = {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason, logprobs: null }],
  };
  if (usage) out.usage = usage;
  return out;
}

export function sse(obj) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

/** Flatten an OpenAI message content (string or parts) to plain text. */
export function contentToText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.type === 'text' ? part.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  return String(content);
}

/** Render a whole conversation as a single prompt (for CLI bridges). */
export function conversationToPrompt(messages) {
  const system = [];
  const turns = [];
  for (const m of messages || []) {
    const text = contentToText(m.content);
    if (m.role === 'system' || m.role === 'developer') {
      if (text) system.push(text);
    } else if (m.role === 'user') {
      turns.push({ role: 'User', text });
    } else if (m.role === 'assistant') {
      turns.push({ role: 'Assistant', text });
    } else if (m.role === 'tool') {
      turns.push({ role: 'Tool result', text });
    }
  }
  const prompt = turns.length === 1 && turns[0].role === 'User'
    ? turns[0].text
    : `${turns.map((t) => `${t.role}: ${t.text}`).join('\n\n')}\n\nAssistant:`;
  return { system: system.join('\n\n'), prompt };
}

/** Stream a finished text completion to an SSE client in modest chunks. */
export function* textToSseChunks({ id, model, content, finishReason = 'stop', usage, includeUsage }) {
  yield sse(chunk({ id, model, delta: { role: 'assistant', content: '' } }));
  const text = content || '';
  const size = 64;
  for (let i = 0; i < text.length; i += size) {
    yield sse(chunk({ id, model, delta: { content: text.slice(i, i + size) } }));
  }
  yield sse(chunk({ id, model, delta: {}, finishReason }));
  if (includeUsage && usage) {
    yield sse({ ...chunk({ id, model }), choices: [], usage });
  }
  yield 'data: [DONE]\n\n';
}
