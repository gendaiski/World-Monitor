#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigStore, publicProvider } from './config.mjs';
import { ProviderError } from './openai-format.mjs';
import { PRESETS } from './presets.mjs';
import { ADAPTERS, dispatch, resolveCandidates } from './router.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const CHAT_PATHS = new Set(['/v1/chat/completions', '/chat/completions', '/api/v1/chat/completions', '/v1/v1/chat/completions']);

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function bearer(req) {
  const auth = req.headers.authorization || '';
  if (/^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim();
  return String(req.headers['x-api-key'] || req.headers['api-key'] || '').trim();
}

function sendJson(res, status, obj, extraHeaders = {}) {
  if (res.headersSent) return;
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  res.end(body);
}

function sendError(res, status, message, type = 'ai_port_error') {
  sendJson(res, status, { error: { message, type, code: status } });
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY_BYTES) throw new ProviderError('request body too large', { status: 413, retryable: false });
    chunks.push(c);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ProviderError('invalid JSON body', { status: 400, retryable: false });
  }
}

export function createAiPort({ env = process.env, configFile = env.AI_PORT_CONFIG || join(process.cwd(), 'data', 'ai-port.json') } = {}) {
  const store = new ConfigStore({ file: configFile, env });
  const token = (env.AI_PORT_TOKEN || '').trim();
  const adminToken = (env.AI_PORT_ADMIN_TOKEN || token).trim();
  const insecure = /^(1|true|yes)$/i.test(env.AI_PORT_INSECURE_NO_AUTH || '');
  const timeoutMs = Number(env.AI_PORT_TIMEOUT_MS) || 180_000;
  const recent = [];
  const dashboardHtml = readFileSync(join(here, '..', 'public', 'index.html'), 'utf8');

  const log = (entry) => {
    const line = { at: new Date().toISOString(), ...entry };
    recent.unshift(line);
    recent.length = Math.min(recent.length, 100);
    const status = entry.ok ? 'ok' : `failed: ${entry.error}`;
    console.log(`[ai-port] ${entry.provider} model=${entry.model} ${entry.ms}ms ${status}`);
    if (!entry.ok && entry.body) console.log(`[ai-port]   upstream body: ${String(entry.body).slice(0, 300)}`);
  };

  function authorize(req, res, { admin = false } = {}) {
    const expected = admin ? adminToken : token;
    if (!expected) {
      if (insecure && !admin) return true;
      sendError(res, 503, admin
        ? 'Set AI_PORT_ADMIN_TOKEN (or AI_PORT_TOKEN) to use the dashboard.'
        : 'Set AI_PORT_TOKEN (or AI_PORT_INSECURE_NO_AUTH=true for a localhost-only setup).', 'auth_not_configured');
      return false;
    }
    const supplied = bearer(req);
    if (supplied && safeEqual(supplied, expected)) return true;
    sendError(res, 401, 'Invalid or missing AI Port token.', 'invalid_api_key');
    return false;
  }

  async function handleChat(req, res) {
    if (!authorize(req, res)) return;
    const body = await readJson(req);
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      sendError(res, 400, '"messages" must be a non-empty array', 'invalid_request_error');
      return;
    }
    const clientAbort = new AbortController();
    res.on('close', () => { if (!res.writableFinished) clientAbort.abort(); });
    const signal = AbortSignal.any([clientAbort.signal, AbortSignal.timeout(timeoutMs)]);

    const result = await dispatch(store, body, { signal, log });
    const routeHeaders = { 'X-AI-Port-Provider': result.provider, 'X-AI-Port-Model': result.model || '' };
    if (result.json) {
      sendJson(res, 200, result.json, routeHeaders);
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...routeHeaders,
    });
    try {
      for await (const piece of result.stream) {
        if (clientAbort.signal.aborted) break;
        res.write(piece);
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: { message: String(err?.message || err), type: 'upstream_error' } })}\n\n`);
    } finally {
      if (clientAbort.signal.aborted) result.abort?.();
      res.end();
    }
  }

  function modelList() {
    const data = [];
    const now = Math.floor(Date.now() / 1000);
    for (const name of new Set(['auto', ...Object.keys(store.routes)])) {
      data.push({ id: name, object: 'model', created: now, owned_by: 'ai-port-route' });
    }
    for (const p of store.enabledProviders()) {
      data.push({ id: p.model ? `${p.id}:${p.model}` : p.id, object: 'model', created: now, owned_by: p.id });
    }
    return { object: 'list', data };
  }

  function adminState() {
    return {
      providers: store.providers.map(publicProvider),
      routes: store.routes,
      presets: Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, {
        label: v.label, kind: v.kind, baseUrl: v.baseUrl, model: v.model, keyOptional: Boolean(v.keyOptional), keyUrl: v.keyUrl || '',
      }])),
      configFile: store.file,
      defaultOrder: resolveCandidates(store, 'auto').map(({ provider, model }) => `${provider.id}${model ? `:${model}` : ''}`),
      recent: recent.slice(0, 30).map(({ body, ...rest }) => rest),
    };
  }

  async function handleAdmin(req, res, path) {
    if (!authorize(req, res, { admin: true })) return;
    if (req.method === 'GET' && path === '/admin/api/state') {
      sendJson(res, 200, adminState());
      return;
    }
    if (req.method === 'PUT' && path === '/admin/api/config') {
      const body = await readJson(req);
      const incoming = Array.isArray(body.providers) ? body.providers : [];
      // Keep stored secrets when the browser sends a provider back without a
      // new key (the dashboard never receives the real key).
      const merged = incoming
        .filter((p) => p.source !== 'env')
        .map((p) => {
          const existing = store.fileProviders.find((e) => e.id === (p.originalId || p.id));
          return { ...p, apiKey: p.apiKey || existing?.apiKey || '' };
        });
      try {
        store.save({ providers: merged, routes: body.routes && typeof body.routes === 'object' ? body.routes : store.routes });
      } catch (err) {
        sendError(res, 400, err.message, 'invalid_config');
        return;
      }
      sendJson(res, 200, adminState());
      return;
    }
    if (req.method === 'POST' && (path === '/admin/api/test' || path === '/admin/api/models')) {
      const body = await readJson(req);
      const provider = store.getProvider(String(body.id || ''));
      if (!provider) {
        sendError(res, 404, 'unknown or disabled provider', 'not_found');
        return;
      }
      const t0 = Date.now();
      try {
        if (path === '/admin/api/models') {
          const models = await ADAPTERS[provider.kind].listModels(provider, { signal: AbortSignal.timeout(20_000) });
          sendJson(res, 200, { ok: true, models });
          return;
        }
        const result = await ADAPTERS[provider.kind].complete({
          provider,
          model: body.model || provider.model,
          body: { messages: [{ role: 'user', content: 'Reply with exactly: AI Port OK' }], max_tokens: 20 },
          signal: AbortSignal.timeout(provider.kind === 'cli' ? 180_000 : 60_000),
        });
        const reply = result.json?.choices?.[0]?.message?.content ?? '';
        log({ provider: provider.id, model: body.model || provider.model, ok: true, ms: Date.now() - t0 });
        sendJson(res, 200, { ok: true, ms: Date.now() - t0, reply: String(reply).slice(0, 200) });
      } catch (err) {
        log({ provider: provider.id, model: body.model || provider.model, ok: false, ms: Date.now() - t0, error: err.message });
        sendJson(res, 200, { ok: false, ms: Date.now() - t0, error: err.message, detail: String(err.body || '').slice(0, 500) });
      }
      return;
    }
    sendError(res, 404, 'not found', 'not_found');
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://ai-port.local');
    const path = url.pathname.replace(/\/+$/, '') || '/';
    try {
      if (req.method === 'GET' && (path === '/' || path === '/dashboard')) {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
        });
        res.end(dashboardHtml);
        return;
      }
      if (req.method === 'GET' && path === '/health') {
        sendJson(res, 200, { ok: true, providers: store.enabledProviders().length, auth: Boolean(token) || insecure });
        return;
      }
      // Ollama-style probe used by the World Monitor desktop settings screen
      // to validate an "Ollama URL"; exposes only the route names.
      if (req.method === 'GET' && path === '/api/tags') {
        sendJson(res, 200, { models: ['auto', ...Object.keys(store.routes)].map((name) => ({ name, model: name })) });
        return;
      }
      if (req.method === 'GET' && (path === '/v1/models' || path === '/models')) {
        if (!authorize(req, res)) return;
        sendJson(res, 200, modelList());
        return;
      }
      if (req.method === 'POST' && CHAT_PATHS.has(path)) {
        await handleChat(req, res);
        return;
      }
      if (path.startsWith('/admin/api/')) {
        await handleAdmin(req, res, path);
        return;
      }
      sendError(res, 404, 'not found', 'not_found');
    } catch (err) {
      const status = err instanceof ProviderError ? err.status : 500;
      if (!res.headersSent) sendError(res, status >= 400 && status < 600 ? status : 502, err.message || 'internal error', 'upstream_error');
      else res.end();
    }
  });

  return { server, store };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('/server.mjs')) {
  const env = process.env;
  const { server, store } = createAiPort({ env });
  const port = Number(env.AI_PORT_PORT || env.PORT) || 8787;
  const host = env.AI_PORT_HOST || '127.0.0.1';
  server.listen(port, host, () => {
    const providers = store.enabledProviders().map((p) => p.id).join(', ') || 'none yet';
    console.log(`[ai-port] listening on http://${host}:${port}  (dashboard: /, OpenAI-compatible: /v1/chat/completions)`);
    console.log(`[ai-port] providers: ${providers}`);
    const insecureMode = /^(1|true|yes)$/i.test(env.AI_PORT_INSECURE_NO_AUTH || '');
    if (insecureMode && !env.AI_PORT_TOKEN && !['127.0.0.1', '::1', 'localhost'].includes(host)) {
      console.warn(`[ai-port] [SECURITY] AI_PORT_INSECURE_NO_AUTH is on while listening on ${host}: anyone who can reach this port can spend your AI credits.`);
    }
    if (!env.AI_PORT_TOKEN && !insecureMode) {
      console.warn('[ai-port] AI_PORT_TOKEN is not set — chat requests will be refused until it is.');
    }
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
