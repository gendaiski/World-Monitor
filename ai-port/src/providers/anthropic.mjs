import Anthropic from '@anthropic-ai/sdk';
import { ProviderError, chunk, completionId, contentToText, isRetryableStatus, sse } from '../openai-format.mjs';

// Translates OpenAI chat-completions requests to the Anthropic Messages API.
//
// Model facts this adapter relies on (current Claude models):
// - Opus 5.5 / Sonnet 5.5 / Opus 5 / Fable reject non-default temperature and
//   top_p, so those are only forwarded to older models that accept them.
// - Thinking is on by default and counts against max_tokens, so callers'
//   small max_tokens values get headroom (we always stream internally, so a
//   large ceiling cannot hit HTTP timeouts).
// - Effort is set explicitly. World Monitor's calls are short summaries and
//   classifications on 20-60 s client budgets, so the port defaults to "low";
//   raise it per provider (options.effort, or AI_PORT_ANTHROPIC_EFFORT).
// - Assistant prefill and forced tool_choice are rejected, so a trailing
//   assistant turn becomes context and "required" tool_choice becomes "auto".
// - The server-side refusal fallback is enabled by default on the first-party
//   API for models that support it; set options.fallbacks=false to disable.

const clients = new Map();

function getClient(provider) {
  const key = `${provider.id}|${provider.baseUrl}|${provider.apiKey}`;
  let client = clients.get(key);
  if (!client) {
    client = new Anthropic({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl || undefined,
      maxRetries: 1,
      defaultHeaders: Object.keys(provider.headers || {}).length ? provider.headers : undefined,
    });
    clients.set(key, client);
  }
  return client;
}

const ACCEPTS_SAMPLING = /claude-(3|haiku-4-5|sonnet-4-5|opus-4-5|sonnet-4-6|opus-4-6|opus-4-1|opus-4-0|sonnet-4-0|opus-4-2|sonnet-4-2)/;
const SUPPORTS_EFFORT = /claude-(fable|mythos|opus-5|sonnet-5|opus-4-[5-8]|sonnet-4-6|opus-4-6)/;
const THINKS_BY_DEFAULT = /claude-(fable|mythos|opus-5|sonnet-5)/;
const SERVER_FALLBACK = /claude-(fable-5-1|opus-5-5|opus-5(?!-)|sonnet-5-5)/;
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

function imagePart(url) {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(url || '');
  if (m) return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
  return { type: 'image', source: { type: 'url', url } };
}

function userContent(content) {
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  if (!Array.isArray(content)) return [{ type: 'text', text: contentToText(content) }];
  const parts = [];
  for (const part of content) {
    if (typeof part === 'string') parts.push({ type: 'text', text: part });
    else if (part?.type === 'text' && part.text) parts.push({ type: 'text', text: part.text });
    else if (part?.type === 'image_url') parts.push(imagePart(part.image_url?.url ?? part.image_url));
  }
  return parts.length ? parts : [{ type: 'text', text: '' }];
}

function safeJson(text) {
  try { return JSON.parse(text || '{}'); } catch { return { _raw: String(text) }; }
}

/** OpenAI messages → { system, messages } for Anthropic. */
export function convertMessages(openaiMessages, extraSystem = '') {
  const system = [];
  const out = [];
  const push = (role, blocks) => {
    const last = out[out.length - 1];
    if (last && last.role === role) last.content.push(...blocks);
    else out.push({ role, content: [...blocks] });
  };

  for (const m of openaiMessages || []) {
    if (m.role === 'system' || m.role === 'developer') {
      const text = contentToText(m.content);
      if (text) system.push(text);
    } else if (m.role === 'user') {
      push('user', userContent(m.content));
    } else if (m.role === 'assistant') {
      const blocks = [];
      const text = contentToText(m.content);
      if (text) blocks.push({ type: 'text', text });
      for (const call of m.tool_calls || []) {
        blocks.push({ type: 'tool_use', id: call.id, name: call.function?.name, input: safeJson(call.function?.arguments) });
      }
      if (blocks.length) push('assistant', blocks);
    } else if (m.role === 'tool') {
      push('user', [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: contentToText(m.content) }]);
    }
  }

  if (out.length === 0 || out[0].role !== 'user') out.unshift({ role: 'user', content: [{ type: 'text', text: '(start)' }] });
  // Prefill is not supported on current models: continue from a user turn.
  if (out[out.length - 1].role === 'assistant') out.push({ role: 'user', content: [{ type: 'text', text: 'Continue.' }] });
  // Drop empty text blocks (the API rejects them).
  for (const msg of out) {
    msg.content = msg.content.filter((b) => b.type !== 'text' || b.text);
    if (!msg.content.length) msg.content.push({ type: 'text', text: '.' });
  }

  if (extraSystem) system.push(extraSystem);
  return { system: system.join('\n\n'), messages: out };
}

function convertTools(tools) {
  if (!Array.isArray(tools) || !tools.length) return undefined;
  return tools
    .filter((t) => t?.type === 'function' && t.function?.name)
    .map((t) => ({
      name: t.function.name,
      description: t.function.description || '',
      input_schema: t.function.parameters || { type: 'object', properties: {} },
    }));
}

function convertToolChoice(choice) {
  if (choice === 'none') return { type: 'none' };
  // Forced tool use ("required" / a named function) is rejected by current
  // models; "auto" plus the caller's prompt is the supported equivalent.
  return choice ? { type: 'auto' } : undefined;
}

function jsonInstruction(responseFormat) {
  if (!responseFormat || responseFormat.type === 'text') return '';
  if (responseFormat.type === 'json_schema' && responseFormat.json_schema?.schema) {
    return `Respond with only a JSON value that conforms to this JSON Schema, with no prose and no code fences:\n${JSON.stringify(responseFormat.json_schema.schema)}`;
  }
  return 'Respond with only a valid JSON object, with no prose and no code fences.';
}

export function buildParams(provider, body, model) {
  const { system, messages } = convertMessages(body.messages, jsonInstruction(body.response_format));
  const requested = Number(body.max_completion_tokens ?? body.max_tokens) || 4096;
  const maxTokens = THINKS_BY_DEFAULT.test(model)
    ? Math.min(Math.max(requested * 2, 16000), 64000)
    : requested;

  const params = { model, max_tokens: maxTokens, messages };
  if (system) params.system = system;
  if (ACCEPTS_SAMPLING.test(model)) {
    if (typeof body.temperature === 'number') params.temperature = Math.min(1, Math.max(0, body.temperature));
    else if (typeof body.top_p === 'number') params.top_p = body.top_p;
  }
  if (body.stop) params.stop_sequences = [].concat(body.stop).slice(0, 4);
  const tools = convertTools(body.tools);
  if (tools?.length) {
    params.tools = tools;
    const toolChoice = convertToolChoice(body.tool_choice);
    if (toolChoice) params.tool_choice = toolChoice;
  }
  if (SUPPORTS_EFFORT.test(model)) {
    const requestedEffort = body.reasoning_effort === 'minimal' ? 'low' : body.reasoning_effort;
    const effort = EFFORTS.has(requestedEffort) ? requestedEffort
      : EFFORTS.has(provider.options?.effort) ? provider.options.effort : 'low';
    params.output_config = { effort };
  }
  const firstParty = !provider.baseUrl || /(^|\.)anthropic\.com$/i.test(new URL(provider.baseUrl).hostname);
  if (firstParty && SERVER_FALLBACK.test(model) && provider.options?.fallbacks !== false) {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }
  return params;
}

function mapStopReason(reason) {
  switch (reason) {
    case 'max_tokens': return 'length';
    case 'tool_use': return 'tool_calls';
    case 'refusal': return 'content_filter';
    default: return 'stop';
  }
}

function toProviderError(provider, err) {
  if (err instanceof Anthropic.APIError && typeof err.status === 'number') {
    return new ProviderError(`${provider.id}: HTTP ${err.status} ${err.message}`.slice(0, 500), {
      status: err.status,
      retryable: isRetryableStatus(err.status),
    });
  }
  if (err?.name === 'AbortError' || err instanceof Anthropic.APIUserAbortError) {
    return new ProviderError(`${provider.id}: aborted`, { status: 499, retryable: false });
  }
  return new ProviderError(`${provider.id}: ${err?.message || err}`, { status: 502 });
}

function stripCodeFence(text) {
  const m = /^\s*```(?:json)?\s*\n([\s\S]*?)\n?```\s*$/.exec(text);
  return m ? m[1] : text;
}

export async function complete({ provider, body, model, signal }) {
  const client = getClient(provider);
  const params = buildParams(provider, body, model);
  const wantsJson = body.response_format && body.response_format.type !== 'text';
  const id = completionId();

  let stream;
  let iterator;
  let first;
  try {
    // Always stream upstream: thinking models need a large max_tokens ceiling,
    // which the SDK only allows without timeouts on a streaming request.
    stream = client.beta.messages.stream(params, { signal });
    iterator = stream[Symbol.asyncIterator]();
    first = await iterator.next();
  } catch (err) {
    throw toProviderError(provider, err);
  }

  if (!body.stream) {
    try {
      // Drain the remaining events, then read the assembled message.
      for (let r = first; !r.done; r = await iterator.next()) { /* consume */ }
      const message = await stream.finalMessage();
      let text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      if (wantsJson) text = stripCodeFence(text);
      const toolCalls = message.content
        .filter((b) => b.type === 'tool_use')
        .map((b) => ({ id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
      const usage = {
        prompt_tokens: message.usage?.input_tokens ?? 0,
        completion_tokens: message.usage?.output_tokens ?? 0,
      };
      usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
      return {
        json: {
          id,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: message.model || model,
          choices: [{
            index: 0,
            message: { role: 'assistant', content: text, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) },
            finish_reason: mapStopReason(message.stop_reason),
            logprobs: null,
          }],
          usage,
        },
      };
    } catch (err) {
      throw toProviderError(provider, err);
    }
  }

  const includeUsage = Boolean(body.stream_options?.include_usage);
  async function* events() {
    yield sse(chunk({ id, model, delta: { role: 'assistant', content: '' } }));
    const toolIndex = new Map();
    let finishReason = 'stop';
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      for (let r = first; !r.done; r = await iterator.next()) {
        const event = r.value;
        if (event.type === 'message_start') {
          inputTokens = event.message?.usage?.input_tokens ?? 0;
        } else if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
          const index = toolIndex.size;
          toolIndex.set(event.index, index);
          yield sse(chunk({ id, model, delta: { tool_calls: [{ index, id: event.content_block.id, type: 'function', function: { name: event.content_block.name, arguments: '' } }] } }));
        } else if (event.type === 'content_block_delta') {
          if (event.delta?.type === 'text_delta' && event.delta.text) {
            yield sse(chunk({ id, model, delta: { content: event.delta.text } }));
          } else if (event.delta?.type === 'input_json_delta' && toolIndex.has(event.index)) {
            yield sse(chunk({ id, model, delta: { tool_calls: [{ index: toolIndex.get(event.index), function: { arguments: event.delta.partial_json } }] } }));
          }
        } else if (event.type === 'message_delta') {
          if (event.delta?.stop_reason) finishReason = mapStopReason(event.delta.stop_reason);
          outputTokens = event.usage?.output_tokens ?? outputTokens;
        }
      }
    } catch (err) {
      const pe = toProviderError(provider, err);
      yield sse({ error: { message: pe.message, type: 'upstream_error' } });
      yield 'data: [DONE]\n\n';
      return;
    }
    yield sse(chunk({ id, model, delta: {}, finishReason }));
    if (includeUsage) {
      yield sse({ ...chunk({ id, model }), choices: [], usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens } });
    }
    yield 'data: [DONE]\n\n';
  }
  return { stream: events(), abort: () => stream.abort() };
}

export async function listModels(provider) {
  const client = getClient(provider);
  const ids = [];
  for await (const m of client.models.list()) ids.push(m.id);
  return ids;
}
