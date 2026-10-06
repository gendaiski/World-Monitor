import { ProviderError, isRetryableStatus } from '../openai-format.mjs';

const UA = 'worldmonitor-ai-port/1.0';

// Standard OpenAI chat-completions request fields. Anything else (for
// example World Monitor's OpenRouter `provider` routing or Ollama's `think`)
// is forwarded only to presets that declare it in `passthrough`, because
// strict providers such as OpenAI reject unknown arguments with a 400.
const STANDARD_FIELDS = new Set([
  'messages', 'temperature', 'top_p', 'max_tokens', 'max_completion_tokens', 'stream',
  'stream_options', 'stop', 'n', 'presence_penalty', 'frequency_penalty', 'seed',
  'response_format', 'tools', 'tool_choice', 'parallel_tool_calls', 'user', 'logprobs',
  'top_logprobs', 'logit_bias', 'reasoning_effort',
]);

/** OpenAI reasoning models take max_completion_tokens and only the default temperature. */
function isOpenAiReasoningModel(model) {
  return /^(o\d|gpt-5)/i.test(model);
}

export function buildRequestBody(provider, body, model) {
  const out = { model };
  for (const [key, value] of Object.entries(body)) {
    if (key === 'model') continue;
    if (STANDARD_FIELDS.has(key) || provider.passthrough.includes(key)) out[key] = value;
  }
  if (provider.preset === 'openai' && isOpenAiReasoningModel(model)) {
    if (out.max_tokens != null && out.max_completion_tokens == null) out.max_completion_tokens = out.max_tokens;
    delete out.max_tokens;
    delete out.temperature;
    delete out.top_p;
  }
  // Perplexity, Cohere and several local servers reject stream_options.
  if (!out.stream) delete out.stream_options;
  return out;
}

export function buildHeaders(provider) {
  const headers = { 'Content-Type': 'application/json', 'User-Agent': UA, ...provider.headers };
  if (provider.apiKey) {
    if (provider.authHeader === 'api-key') headers['api-key'] = provider.apiKey;
    else headers.Authorization = `Bearer ${provider.apiKey}`;
  }
  return headers;
}

async function readBounded(resp, cap = 2000) {
  try {
    const text = await resp.text();
    return text.slice(0, cap);
  } catch {
    return '';
  }
}

export async function complete({ provider, body, model, signal }) {
  const url = `${provider.baseUrl}/chat/completions`;
  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(provider),
      body: JSON.stringify(buildRequestBody(provider, body, model)),
      signal,
    });
  } catch (err) {
    throw new ProviderError(`${provider.id}: ${err.name === 'TimeoutError' ? 'timed out' : err.message}`, { status: 504 });
  }

  if (!resp.ok) {
    const errBody = await readBounded(resp);
    throw new ProviderError(`${provider.id}: HTTP ${resp.status}`, {
      status: resp.status,
      retryable: isRetryableStatus(resp.status),
      body: errBody,
    });
  }

  if (body.stream) {
    if (!resp.body) throw new ProviderError(`${provider.id}: empty stream`);
    return { stream: resp.body };
  }

  let json;
  try {
    json = await resp.json();
  } catch {
    throw new ProviderError(`${provider.id}: invalid JSON response`);
  }
  if (!json?.choices?.length) throw new ProviderError(`${provider.id}: response had no choices`);
  return { json };
}

export async function listModels(provider, { signal } = {}) {
  const resp = await fetch(`${provider.baseUrl}/models`, { headers: buildHeaders(provider), signal });
  if (!resp.ok) throw new ProviderError(`${provider.id}: HTTP ${resp.status}`, { status: resp.status, body: await readBounded(resp) });
  const json = await resp.json();
  const items = Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : Array.isArray(json) ? json : [];
  return items.map((m) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean).sort();
}
