import * as anthropic from './providers/anthropic.mjs';
import * as cliBridge from './providers/cli-bridge.mjs';
import * as openaiCompatible from './providers/openai-compatible.mjs';
import { ProviderError } from './openai-format.mjs';

export const ADAPTERS = { openai: openaiCompatible, anthropic, cli: cliBridge };

/** Names that always mean "use a route", never a literal model id. */
const ROUTE_ALIASES = new Set(['auto', 'default', '']);

/**
 * Parse a route entry "providerId" or "providerId:model" / "providerId/model".
 * Returns null when the prefix is not a configured provider.
 */
export function parseTarget(store, ref) {
  const text = String(ref || '').trim();
  if (!text) return null;
  const direct = store.getProvider(text);
  if (direct) return { provider: direct, model: direct.model };
  for (const sep of [':', '/']) {
    const i = text.indexOf(sep);
    if (i <= 0) continue;
    const provider = store.getProvider(text.slice(0, i).toLowerCase());
    if (provider) return { provider, model: text.slice(i + 1) || provider.model };
  }
  return null;
}

function routeTargets(store, name) {
  const entries = store.routes[name];
  if (Array.isArray(entries) && entries.length) {
    return entries.map((ref) => parseTarget(store, ref)).filter(Boolean);
  }
  return store.enabledProviders().map((provider) => ({ provider, model: provider.model }));
}

/**
 * Resolve the ordered list of {provider, model} candidates for a request.
 *
 *  1. "providerId:model" / "providerId/model" / "providerId" → that provider,
 *     then the default route as fallback.
 *  2. A route name ("auto", "default", "fast", any configured route).
 *  3. A model id that some provider lists as its model → that provider first.
 *  4. Anything else (for example World Monitor's built-in default model
 *     names) → the default route, each provider with its own model.
 */
export function resolveCandidates(store, requestedModel) {
  const requested = String(requestedModel || '').trim();
  const fallback = routeTargets(store, 'default');
  let primary = [];

  const target = parseTarget(store, requested);
  if (target) {
    primary = [target];
  } else if (!ROUTE_ALIASES.has(requested.toLowerCase()) && store.routes[requested]) {
    primary = routeTargets(store, requested);
  } else if (requested && !ROUTE_ALIASES.has(requested.toLowerCase())) {
    primary = store.enabledProviders()
      .filter((p) => p.model === requested)
      .map((provider) => ({ provider, model: requested }));
  }

  const strict = /^(1|true|yes)$/i.test(store.env.AI_PORT_STRICT_MODEL || '');
  const all = strict && primary.length ? primary : [...primary, ...fallback];
  const seen = new Set();
  return all.filter(({ provider, model }) => {
    const key = `${provider.id}\u0000${model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Try candidates in order until one succeeds. A provider error before any
 * output is sent moves on to the next candidate; non-retryable errors (bad
 * request shape, client abort) stop immediately.
 */
export async function dispatch(store, body, { signal, log = () => {} } = {}) {
  const candidates = resolveCandidates(store, body.model);
  if (!candidates.length) {
    throw new ProviderError('No AI provider is configured. Open the AI Port dashboard or set a provider API key.', { status: 503, retryable: false });
  }
  const errors = [];
  for (const { provider, model } of candidates) {
    const adapter = ADAPTERS[provider.kind];
    if (!adapter) continue;
    if (provider.kind !== 'cli' && !model) {
      errors.push(`${provider.id}: no model configured`);
      continue;
    }
    const t0 = Date.now();
    try {
      const result = await adapter.complete({ provider, body, model, signal });
      log({ provider: provider.id, model, ok: true, ms: Date.now() - t0 });
      return { ...result, provider: provider.id, model };
    } catch (err) {
      const pe = err instanceof ProviderError ? err : new ProviderError(String(err?.message || err));
      log({ provider: provider.id, model, ok: false, ms: Date.now() - t0, error: pe.message, body: pe.body });
      errors.push(pe.message);
      if (signal?.aborted || pe.status === 499) throw pe;
      if (!pe.retryable && candidates.length === 1) throw pe;
    }
  }
  throw new ProviderError(`All AI providers failed: ${errors.join(' | ')}`.slice(0, 2000), { status: 502, retryable: false });
}
