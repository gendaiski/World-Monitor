import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ENV_DISCOVERY_ORDER, PRESETS } from './presets.mjs';

const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

function firstEnv(env, names) {
  for (const name of [].concat(names || [])) {
    const value = (env[name] || '').trim();
    if (value) return value;
  }
  return '';
}

function truthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

/**
 * Build a normalized provider record from a preset plus user fields.
 * Throws on invalid input so the admin API can report it.
 */
export function normalizeProvider(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('provider must be an object');
  const presetName = String(raw.preset || raw.type || '').trim();
  const preset = PRESETS[presetName];
  if (!preset) throw new Error(`unknown preset "${presetName}"`);
  const id = String(raw.id || presetName).trim().toLowerCase();
  if (!ID_RE.test(id)) throw new Error(`invalid provider id "${id}" (use a-z, 0-9, ".", "_", "-")`);

  const baseUrl = String(raw.baseUrl ?? preset.baseUrl ?? '').trim().replace(/\/+$/, '');
  if (preset.kind !== 'cli') {
    if (!baseUrl) throw new Error(`${id}: baseUrl is required`);
    let parsed;
    try { parsed = new URL(baseUrl); } catch { throw new Error(`${id}: baseUrl is not a valid URL`); }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error(`${id}: baseUrl must be http(s)`);
  }

  const apiKey = String(raw.apiKey || '').trim();
  if (!apiKey && !preset.keyOptional) throw new Error(`${id}: apiKey is required for ${preset.label}`);

  const headers = { ...(preset.headers || {}) };
  if (raw.headers && typeof raw.headers === 'object') {
    for (const [k, v] of Object.entries(raw.headers)) headers[String(k)] = String(v);
  }

  const options = { ...(raw.options && typeof raw.options === 'object' ? raw.options : {}) };

  return {
    id,
    preset: presetName,
    kind: preset.kind,
    label: String(raw.label || preset.label),
    baseUrl,
    apiKey,
    model: String(raw.model ?? preset.model ?? '').trim(),
    headers,
    authHeader: preset.authHeader || 'authorization',
    passthrough: preset.passthrough || [],
    command: preset.kind === 'cli' ? String(raw.command || preset.command) : undefined,
    cli: preset.cli,
    enabled: raw.enabled !== false,
    source: raw.source || 'file',
    options,
  };
}

/** Providers discovered from conventional environment variables. */
export function providersFromEnv(env = process.env) {
  const out = [];
  for (const presetName of ENV_DISCOVERY_ORDER) {
    const preset = PRESETS[presetName];
    if (preset.kind === 'cli') {
      if (!truthy(env[preset.envEnable])) continue;
      out.push(normalizeProvider({
        preset: presetName,
        model: firstEnv(env, `${preset.envEnable.replace(/^AI_PORT_ENABLE_/, 'AI_PORT_')}_MODEL`),
        command: firstEnv(env, `${preset.envEnable.replace(/^AI_PORT_ENABLE_/, 'AI_PORT_')}_COMMAND`) || undefined,
        source: 'env',
      }));
      continue;
    }
    const apiKey = firstEnv(env, preset.envKey);
    const baseUrl = firstEnv(env, preset.envBaseUrl);
    // Keyless local presets need an explicit base URL to be discovered;
    // keyed presets need their key.
    if (preset.keyOptional ? !baseUrl : !apiKey) continue;
    if (!preset.baseUrl && !baseUrl) continue;
    try {
      out.push(normalizeProvider({
        preset: presetName,
        apiKey,
        baseUrl: baseUrl || undefined,
        model: firstEnv(env, preset.envModel) || undefined,
        options: presetName === 'anthropic' && env.AI_PORT_ANTHROPIC_EFFORT
          ? { effort: env.AI_PORT_ANTHROPIC_EFFORT.trim() }
          : undefined,
        source: 'env',
      }));
    } catch (err) {
      console.warn(`[ai-port] skipping ${presetName} from env: ${err.message}`);
    }
  }
  return out;
}

function parseRouteList(value) {
  return String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export class ConfigStore {
  constructor({ file, env = process.env } = {}) {
    this.env = env;
    this.file = file ? resolve(file) : null;
    this.reload();
  }

  reload() {
    let fileData = { providers: [], routes: {} };
    if (this.file && existsSync(this.file)) {
      try {
        fileData = JSON.parse(readFileSync(this.file, 'utf8'));
      } catch (err) {
        throw new Error(`[ai-port] cannot parse ${this.file}: ${err.message}`);
      }
    }
    const fileProviders = [];
    for (const raw of Array.isArray(fileData.providers) ? fileData.providers : []) {
      try {
        fileProviders.push(normalizeProvider({ ...raw, source: 'file' }));
      } catch (err) {
        console.warn(`[ai-port] ignoring provider in config file: ${err.message}`);
      }
    }
    // File entries win over env entries with the same id.
    const fileIds = new Set(fileProviders.map((p) => p.id));
    const envProviders = providersFromEnv(this.env).filter((p) => !fileIds.has(p.id));
    this.fileProviders = fileProviders;
    this.providers = [...fileProviders, ...envProviders];

    const routes = {};
    for (const [name, list] of Object.entries(fileData.routes || {})) {
      if (Array.isArray(list)) routes[name] = list.map(String);
    }
    if (this.env.AI_PORT_DEFAULT_ROUTE) routes.default = parseRouteList(this.env.AI_PORT_DEFAULT_ROUTE);
    if (this.env.AI_PORT_FAST_ROUTE) routes.fast = parseRouteList(this.env.AI_PORT_FAST_ROUTE);
    this.routes = routes;
  }

  getProvider(id) {
    return this.providers.find((p) => p.id === id && p.enabled) || null;
  }

  enabledProviders() {
    return this.providers.filter((p) => p.enabled);
  }

  /** Persist only file-sourced providers; env providers stay in the env. */
  save({ providers, routes }) {
    if (!this.file) throw new Error('no config file configured (set AI_PORT_CONFIG)');
    const normalized = providers.map((p) => normalizeProvider({ ...p, source: 'file' }));
    const ids = new Set();
    for (const p of normalized) {
      if (ids.has(p.id)) throw new Error(`duplicate provider id "${p.id}"`);
      ids.add(p.id);
    }
    const data = {
      providers: normalized.map((p) => ({
        id: p.id,
        preset: p.preset,
        label: p.label,
        baseUrl: p.baseUrl,
        apiKey: p.apiKey,
        model: p.model,
        headers: Object.keys(p.headers).length ? p.headers : undefined,
        command: p.command,
        enabled: p.enabled,
        options: Object.keys(p.options).length ? p.options : undefined,
      })),
      routes: routes || this.routes,
    };
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp-${process.pid}`;
    writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
    renameSync(tmp, this.file);
    try { chmodSync(this.file, 0o600); } catch { /* best effort on exotic filesystems */ }
    this.reload();
  }
}

/** Never send stored secrets to a browser. */
export function maskSecret(secret) {
  if (!secret) return '';
  if (secret.length <= 8) return '••••';
  return `${secret.slice(0, 4)}…${secret.slice(-4)}`;
}

export function publicProvider(p) {
  return {
    id: p.id,
    preset: p.preset,
    kind: p.kind,
    label: p.label,
    baseUrl: p.baseUrl,
    model: p.model,
    command: p.command,
    enabled: p.enabled,
    source: p.source,
    hasKey: Boolean(p.apiKey),
    keyPreview: maskSecret(p.apiKey),
    options: p.options,
  };
}
