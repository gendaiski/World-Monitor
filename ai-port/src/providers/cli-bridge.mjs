import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProviderError, buildCompletion, completionId, conversationToPrompt, textToSseChunks } from '../openai-format.mjs';

// Subscription bridge: runs the provider's own official CLI, already logged
// in with the user's Claude / ChatGPT / Google account, in headless one-shot
// mode. No credentials are read, copied or replayed by this service — the CLI
// owns authentication. Each subscription's usage limits and terms still
// apply; use an API key for heavy, always-on workloads.

const DEFAULT_TIMEOUT_MS = 180_000;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

// Small per-provider concurrency gate: CLIs are heavyweight processes.
const gates = new Map();
function gateFor(provider) {
  const limit = Math.max(1, Number(provider.options?.concurrency) || 2);
  let gate = gates.get(provider.id);
  if (!gate || gate.limit !== limit) {
    gate = { limit, active: 0, queue: [] };
    gates.set(provider.id, gate);
  }
  return gate;
}
async function withGate(provider, fn) {
  const gate = gateFor(provider);
  if (gate.active >= gate.limit) await new Promise((resolve) => gate.queue.push(resolve));
  gate.active += 1;
  try {
    return await fn();
  } finally {
    gate.active -= 1;
    gate.queue.shift()?.();
  }
}

function run(command, args, { input, timeoutMs, signal, env }) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      // Run outside any project so no repository instructions or settings load.
      child = spawn(command, args, { cwd: tmpdir(), stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ...env } });
    } catch (err) {
      reject(err);
      return;
    }
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
      fn(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(reject, new ProviderError(`${command}: timed out after ${timeoutMs} ms`, { status: 504 }));
    }, timeoutMs);
    const onAbort = () => {
      child.kill('SIGKILL');
      finish(reject, new ProviderError(`${command}: aborted`, { status: 499, retryable: false }));
    };
    signal?.addEventListener?.('abort', onAbort, { once: true });
    child.stdout.on('data', (d) => {
      if (stdout.length < MAX_OUTPUT_BYTES) stdout += d;
    });
    child.stderr.on('data', (d) => {
      if (stderr.length < 64 * 1024) stderr += d;
    });
    child.on('error', (err) => {
      finish(reject, new ProviderError(
        err.code === 'ENOENT' ? `${command}: not installed or not on PATH` : `${command}: ${err.message}`,
        { status: 503 },
      ));
    });
    child.on('close', (code) => {
      if (code === 0) finish(resolve, { stdout, stderr });
      else finish(reject, new ProviderError(`${command}: exited with code ${code}: ${(stderr || stdout).trim().slice(0, 400)}`, { status: 502 }));
    });
    child.stdin.on('error', () => { /* the close handler reports the failure */ });
    child.stdin.end(input);
  });
}

// ── Per-CLI invocation ──────────────────────────────────────────────────────

async function runClaude(provider, { system, prompt, model, timeoutMs, signal }) {
  // Claude Code headless mode: no tools, no MCP servers, only the user's own
  // settings (never a project's), no saved session — a one-shot completion.
  const args = [
    '-p', '--output-format', 'json',
    '--strict-mcp-config',
    '--setting-sources', 'user',
    '--no-session-persistence',
    '--tools', '',
  ];
  if (system) args.push('--system-prompt', system);
  if (model) args.push('--model', model);
  const { stdout } = await run(provider.command, args, { input: prompt, timeoutMs, signal });
  let parsed;
  try {
    parsed = JSON.parse(stdout.trim().split('\n').filter(Boolean).pop());
  } catch {
    return { text: stdout.trim() };
  }
  if (parsed.is_error) throw new ProviderError(`claude: ${String(parsed.result || parsed.subtype || 'error').slice(0, 400)}`, { status: 502 });
  return {
    text: String(parsed.result ?? ''),
    usage: parsed.usage ? {
      prompt_tokens: parsed.usage.input_tokens ?? 0,
      completion_tokens: parsed.usage.output_tokens ?? 0,
    } : undefined,
  };
}

async function runCodex(provider, { system, prompt, model, timeoutMs, signal }) {
  // Codex CLI non-interactive mode with a read-only sandbox; the final
  // assistant message is written to a temp file.
  const dir = await mkdtemp(join(tmpdir(), 'ai-port-codex-'));
  const outFile = join(dir, 'last-message.txt');
  try {
    const args = ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--color', 'never', '--output-last-message', outFile];
    if (model) args.push('--model', model);
    args.push('-');
    const input = system ? `${system}\n\n---\n\n${prompt}` : prompt;
    const { stdout } = await run(provider.command, args, { input, timeoutMs, signal });
    const text = await readFile(outFile, 'utf8').catch(() => stdout);
    return { text: text.trim() };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function runGemini(provider, { system, prompt, model, timeoutMs, signal }) {
  // Gemini CLI: stdin is the prompt; -p with a single space selects headless mode.
  const args = ['-p', ' ', '--output-format', 'json'];
  if (model) args.push('-m', model);
  const input = system ? `${system}\n\n---\n\n${prompt}` : prompt;
  const { stdout } = await run(provider.command, args, { input, timeoutMs, signal });
  try {
    const parsed = JSON.parse(stdout);
    if (parsed.error) throw new ProviderError(`gemini: ${JSON.stringify(parsed.error).slice(0, 400)}`, { status: 502 });
    return { text: String(parsed.response ?? '').trim() };
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    return { text: stdout.trim() };
  }
}

const RUNNERS = { claude: runClaude, codex: runCodex, gemini: runGemini };

export async function complete({ provider, body, model, signal }) {
  const runner = RUNNERS[provider.cli];
  if (!runner) throw new ProviderError(`${provider.id}: unsupported CLI "${provider.cli}"`, { status: 500, retryable: true });
  const { system, prompt } = conversationToPrompt(body.messages);
  const jsonHint = body.response_format && body.response_format.type !== 'text'
    ? '\n\nRespond with only a valid JSON value, no prose and no code fences.'
    : '';
  const timeoutMs = Number(provider.options?.timeoutMs) || DEFAULT_TIMEOUT_MS;

  const { text, usage: rawUsage } = await withGate(provider, () => runner(provider, {
    system: `${system}${jsonHint}`.trim(),
    prompt,
    model: model || undefined,
    timeoutMs,
    signal,
  }));
  if (!text) throw new ProviderError(`${provider.id}: empty response`, { status: 502 });

  const usage = rawUsage ? { ...rawUsage, total_tokens: rawUsage.prompt_tokens + rawUsage.completion_tokens } : undefined;
  const id = completionId();
  const responseModel = model || provider.preset;
  if (body.stream) {
    return {
      stream: textToSseChunks({ id, model: responseModel, content: text, usage, includeUsage: body.stream_options?.include_usage }),
    };
  }
  return { json: buildCompletion({ id, model: responseModel, content: text, usage }) };
}

export async function listModels(provider) {
  if (provider.cli === 'claude') return ['opus', 'sonnet', 'haiku'];
  return [];
}
