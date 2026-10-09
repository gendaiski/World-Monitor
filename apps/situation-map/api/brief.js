// GET /api/brief?kind=<kind>&id=<id>
//
// Writes a short intelligence brief for one item on the situation map. The
// server looks the item up in its own copy of the curated data, so callers
// cannot send arbitrary prompts, and the CDN caches each answer per item so
// repeat visits do not spend AI credits.
//
// Connect an AI with environment variables in the Vercel project:
//   ANTHROPIC_API_KEY (+ optional ANTHROPIC_MODEL), or
//   AI_BASE_URL + AI_API_KEY + AI_MODEL for any OpenAI-compatible endpoint:
//   World Monitor's AI Port, OpenRouter, Groq, Gemini, OpenAI, Ollama, ...
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const LAYERS = JSON.parse(readFileSync(join(here, '..', 'data', 'layers.json'), 'utf8'));

export const KINDS = {
  hotspot: ['INTEL_HOTSPOTS', 'Intel hotspot'],
  conflict: ['CONFLICT_ZONES', 'Conflict zone'],
  waterway: ['STRATEGIC_WATERWAYS', 'Chokepoint'],
  base: ['MILITARY_BASES', 'Military base'],
  nuclear: ['NUCLEAR_FACILITIES', 'Nuclear facility'],
  cable: ['UNDERSEA_CABLES', 'Undersea cable'],
  pipeline: ['PIPELINES', 'Pipeline'],
  aidc: ['AI_DATA_CENTERS', 'AI data center'],
  econ: ['ECONOMIC_CENTERS', 'Economic center'],
  spaceport: ['SPACEPORTS', 'Spaceport'],
};

export function findItem(kind, id, layers = LAYERS) {
  const entry = KINDS[kind];
  if (!entry || typeof id !== 'string' || id.length > 200) return null;
  return layers[entry[0]]?.find((item) => item.id === id) ?? null;
}

export function buildPrompt(kind, item, layers = LAYERS) {
  const copy = { kind: KINDS[kind][1], ...item };
  delete copy.coords; delete copy.points; delete copy.keywords;
  if (copy.landingPoints) copy.landingPoints = copy.landingPoints.map((p) => `${p.city}, ${p.countryName}`);
  const nearby = kind === 'hotspot' || kind === 'conflict'
    ? layers.CONFLICT_ZONES.filter((c) => c.id !== item.id).slice(0, 4).map((c) => `${c.name} (${c.intensity})`).join('; ')
    : '';
  return [
    'You are the analyst panel of World Monitor, a geopolitical intelligence dashboard.',
    'Write a tight intelligence brief about the item below, using ONLY the data given. Do not add events, numbers, or dates that are not in the data, and do not claim knowledge of anything after it.',
    'Format: a one-line bottom line, then three short sections headed "Situation", "Why it matters", and "Watch for", each 1-3 sentences. Plain text, no markdown symbols, under 170 words.',
    '',
    `Item (World Monitor curated dataset):\n${JSON.stringify(copy, null, 1).slice(0, 6000)}`,
    nearby ? `\nOther active conflicts on the dashboard: ${nearby}` : '',
  ].join('\n');
}

export function pickProvider(env = process.env) {
  if (env.ANTHROPIC_API_KEY) {
    return { kind: 'anthropic', apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL || 'claude-opus-5-5' };
  }
  if (env.AI_BASE_URL && env.AI_MODEL) {
    return { kind: 'openai', baseUrl: env.AI_BASE_URL.replace(/\/+$/, ''), apiKey: env.AI_API_KEY || '', model: env.AI_MODEL };
  }
  return null;
}

// Current Claude models: effort is set explicitly; the server-side refusal
// fallback is opt-in and only exists on the first-party API for these models.
const SUPPORTS_EFFORT = /claude-(fable|mythos|opus-5|sonnet-5|opus-4-[5-8]|sonnet-4-6)/;
const SERVER_FALLBACK = /claude-(fable-5-1|opus-5-5|opus-5(?!-)|sonnet-5-5)/;

async function briefWithAnthropic(provider, prompt) {
  const client = new Anthropic({ apiKey: provider.apiKey, maxRetries: 1 });
  const params = {
    model: provider.model,
    // Thinking is on by default on current models and counts against max_tokens.
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  };
  if (SUPPORTS_EFFORT.test(provider.model)) params.output_config = { effort: 'low' };
  if (SERVER_FALLBACK.test(provider.model)) {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }
  const message = await client.beta.messages.create(params);
  if (message.stop_reason === 'refusal') throw Object.assign(new Error('The model declined this request.'), { status: 422 });
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  return { text, model: message.model || provider.model };
}

async function briefWithOpenAiCompatible(provider, prompt, fetchImpl) {
  const headers = { 'Content-Type': 'application/json', 'User-Agent': 'worldmonitor-situation-map/1.0' };
  if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`;
  const resp = await fetchImpl(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: provider.model, messages: [{ role: 'user', content: prompt }], max_tokens: 1200 }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!resp.ok) throw Object.assign(new Error(`The AI provider answered HTTP ${resp.status}.`), { status: 502 });
  const json = await resp.json();
  const text = String(json?.choices?.[0]?.message?.content ?? '').trim();
  return { text, model: json?.model || provider.model };
}

export async function writeBrief(kind, id, { env = process.env, fetchImpl = (...a) => globalThis.fetch(...a) } = {}) {
  const item = findItem(kind, id);
  if (!item) return { status: 404, body: { error: 'Unknown map item.' } };
  const provider = pickProvider(env);
  if (!provider) return { status: 503, body: { error: 'no_ai', message: 'No AI is connected to this site yet.' } };
  const prompt = buildPrompt(kind, item);
  try {
    const { text, model } = provider.kind === 'anthropic'
      ? await briefWithAnthropic(provider, prompt)
      : await briefWithOpenAiCompatible(provider, prompt, fetchImpl);
    if (!text) return { status: 502, body: { error: 'The AI returned an empty answer.' } };
    return { status: 200, body: { text, model, item: item.name }, cache: true };
  } catch (err) {
    console.error('[brief]', err?.status ?? '', err?.message ?? err);
    const status = err?.status === 422 ? 422 : 502;
    return { status, body: { error: status === 422 ? 'The AI declined to brief on this item.' : 'The AI provider did not answer. Try again in a minute.' } };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Use GET.' });
    return;
  }
  const { kind, id } = req.query || {};
  const result = await writeBrief(String(kind || ''), String(id || ''));
  // One cached answer per item at the edge: bounded spend, fast repeat views.
  res.setHeader('Cache-Control', result.cache ? 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800' : 'no-store');
  res.status(result.status).json(result.body);
}
