import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chmodSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAiPort } from '../src/server.mjs';
import { buildParams, convertMessages } from '../src/providers/anthropic.mjs';
import { buildRequestBody } from '../src/providers/openai-compatible.mjs';
import { normalizeProvider } from '../src/config.mjs';

const TOKEN = 'test-token-123';

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

// ── Mock upstreams ──────────────────────────────────────────────────────────

function openAiMock({ failWith } = {}) {
  const calls = [];
  const server = createServer(async (req, res) => {
    const body = await readBody(req);
    calls.push({ url: req.url, headers: req.headers, body });
    if (failWith) {
      res.writeHead(failWith, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'mock failure' } }));
      return;
    }
    if (req.url.endsWith('/models')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'b-model' }, { id: 'a-model' }] }));
      return;
    }
    if (body.stream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: 'Hel' } }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: 'lo' } }] })}\n\n`);
      res.end('data: [DONE]\n\n');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: 'x', object: 'chat.completion', model: body.model,
      choices: [{ index: 0, message: { role: 'assistant', content: `echo:${body.model}` }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    }));
  });
  return { server, calls };
}

function anthropicMock() {
  const calls = [];
  const server = createServer(async (req, res) => {
    const body = await readBody(req);
    calls.push({ url: req.url, headers: req.headers, body });
    const send = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    send('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, usage: { input_tokens: 11, output_tokens: 0 } } });
    send('content_block_start', { index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } });
    send('content_block_delta', { index: 0, delta: { type: 'signature_delta', signature: 'sig' } });
    send('content_block_stop', { index: 0 });
    send('content_block_start', { index: 1, content_block: { type: 'text', text: '' } });
    send('content_block_delta', { index: 1, delta: { type: 'text_delta', text: 'Hello from ' } });
    send('content_block_delta', { index: 1, delta: { type: 'text_delta', text: 'Claude' } });
    send('content_block_stop', { index: 1 });
    send('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 7 } });
    send('message_stop', {});
    res.end();
  });
  return { server, calls };
}

async function chat(base, body, token = TOKEN) {
  const resp = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return resp;
}

// ── Suite ───────────────────────────────────────────────────────────────────

describe('AI Port end to end', () => {
  const good = openAiMock();
  const bad = openAiMock({ failWith: 500 });
  const claude = anthropicMock();
  let port;
  let base;
  let dir;
  let fakeCliLog;

  before(async () => {
    const goodUrl = await listen(good.server);
    const badUrl = await listen(bad.server);
    const claudeUrl = await listen(claude.server);
    dir = mkdtempSync(join(tmpdir(), 'ai-port-test-'));

    // Fake "claude" CLI: records its argv and stdin, prints Claude Code JSON.
    fakeCliLog = join(dir, 'cli-log.json');
    const fakeCli = join(dir, 'claude');
    writeFileSync(fakeCli, `#!/usr/bin/env node
let input = '';
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('end', () => {
  require('fs').writeFileSync(${JSON.stringify(fakeCliLog)}, JSON.stringify({ argv: process.argv.slice(2), input }));
  process.stdout.write(JSON.stringify({ type: 'result', is_error: false, result: 'from subscription', usage: { input_tokens: 4, output_tokens: 3 } }) + '\\n');
});
`);
    chmodSync(fakeCli, 0o755);

    const configFile = join(dir, 'ai-port.json');
    writeFileSync(configFile, JSON.stringify({
      providers: [
        { id: 'flaky', preset: 'custom', baseUrl: badUrl, apiKey: 'k1', model: 'flaky-model' },
        { id: 'good', preset: 'openai', baseUrl: goodUrl, apiKey: 'sk-good', model: 'gpt-4.1-mini' },
        { id: 'router', preset: 'openrouter', baseUrl: goodUrl, apiKey: 'sk-or', model: 'google/gemini-2.5-flash' },
        { id: 'claude', preset: 'anthropic', baseUrl: claudeUrl, apiKey: 'sk-ant', model: 'claude-opus-5-5' },
        { id: 'sub', preset: 'claude-subscription', command: fakeCli },
      ],
      routes: { fast: ['router', 'good'] },
    }));
    ({ server: port } = createAiPort({ env: { AI_PORT_TOKEN: TOKEN }, configFile }));
    base = await listen(port);
  });

  after(() => {
    for (const s of [good.server, bad.server, claude.server, port]) s.close();
  });

  test('rejects requests without the port token', async () => {
    const resp = await chat(base, { messages: [{ role: 'user', content: 'hi' }] }, 'wrong');
    assert.equal(resp.status, 401);
  });

  test('auto falls back past a failing provider', async () => {
    const resp = await chat(base, { model: 'auto', messages: [{ role: 'user', content: 'hi' }] });
    assert.equal(resp.status, 200);
    assert.equal(resp.headers.get('x-ai-port-provider'), 'good');
    const json = await resp.json();
    assert.equal(json.choices[0].message.content, 'echo:gpt-4.1-mini');
    assert.equal(bad.calls.length, 1);
  });

  test('unknown model names (World Monitor defaults) use the default route', async () => {
    const resp = await chat(base, { model: 'llama3.1:8b', messages: [{ role: 'user', content: 'hi' }], think: false });
    assert.equal(resp.status, 200);
    assert.equal(resp.headers.get('x-ai-port-provider'), 'good');
  });

  test('provider:model selects a provider and model explicitly', async () => {
    const resp = await chat(base, { model: 'router:meta/llama-4', messages: [{ role: 'user', content: 'hi' }], provider: { sort: 'price' } });
    const json = await resp.json();
    assert.equal(json.choices[0].message.content, 'echo:meta/llama-4');
    const last = good.calls.at(-1);
    assert.deepEqual(last.body.provider, { sort: 'price' }, 'OpenRouter keeps its routing field');
    assert.equal(last.headers.authorization, 'Bearer sk-or');
  });

  test('strict providers do not receive non-standard fields', async () => {
    await chat(base, { model: 'good', messages: [{ role: 'user', content: 'hi' }], provider: { sort: 'price' }, reasoning: { enabled: false }, think: false });
    const last = good.calls.at(-1);
    assert.equal(last.body.provider, undefined);
    assert.equal(last.body.reasoning, undefined);
    assert.equal(last.body.think, undefined);
  });

  test('named routes are honoured', async () => {
    const resp = await chat(base, { model: 'fast', messages: [{ role: 'user', content: 'hi' }] });
    assert.equal(resp.headers.get('x-ai-port-provider'), 'router');
  });

  test('streams pass through from OpenAI-compatible providers', async () => {
    const resp = await chat(base, { model: 'good', stream: true, messages: [{ role: 'user', content: 'hi' }] });
    assert.match(resp.headers.get('content-type'), /event-stream/);
    const text = await resp.text();
    assert.match(text, /"Hel"/);
    assert.match(text, /\[DONE\]/);
  });

  test('Anthropic: translates request and response', async () => {
    const resp = await chat(base, {
      model: 'claude',
      temperature: 0.2,
      max_tokens: 300,
      messages: [
        { role: 'system', content: 'Be brief.' },
        { role: 'user', content: 'Summarize the news.' },
      ],
    });
    assert.equal(resp.status, 200);
    const json = await resp.json();
    assert.equal(json.choices[0].message.content, 'Hello from Claude');
    assert.equal(json.choices[0].finish_reason, 'stop');
    assert.equal(json.usage.prompt_tokens, 11);
    assert.equal(json.usage.completion_tokens, 7);

    const sent = claude.calls.at(-1);
    assert.equal(sent.url.split('?')[0], '/v1/messages');
    assert.equal(sent.headers['x-api-key'], 'sk-ant');
    assert.equal(sent.body.model, 'claude-opus-5-5');
    assert.equal(sent.body.system, 'Be brief.');
    assert.equal(sent.body.temperature, undefined, 'Opus 5.5 rejects temperature');
    assert.equal(sent.body.stream, true);
    assert.ok(sent.body.max_tokens >= 16000, 'thinking headroom added');
    assert.deepEqual(sent.body.output_config, { effort: 'low' });
    assert.equal(sent.body.fallbacks, undefined, 'server fallback only on the first-party API');
  });

  test('Anthropic: streaming is converted to OpenAI chunks', async () => {
    const resp = await chat(base, { model: 'claude', stream: true, stream_options: { include_usage: true }, messages: [{ role: 'user', content: 'hi' }] });
    const text = await resp.text();
    const events = text.split('\n\n').filter((l) => l.startsWith('data: ') && !l.includes('[DONE]')).map((l) => JSON.parse(l.slice(6)));
    const content = events.map((e) => e.choices?.[0]?.delta?.content || '').join('');
    assert.equal(content, 'Hello from Claude');
    assert.equal(events.find((e) => e.choices?.[0]?.finish_reason)?.choices[0].finish_reason, 'stop');
    assert.equal(events.at(-1).usage.completion_tokens, 7);
    assert.match(text, /data: \[DONE\]\n\n$/);
  });

  test('subscription bridge runs the official CLI headlessly', async () => {
    const resp = await chat(base, {
      model: 'sub',
      messages: [{ role: 'system', content: 'You are an analyst.' }, { role: 'user', content: 'What happened?' }],
    });
    const json = await resp.json();
    assert.equal(json.choices[0].message.content, 'from subscription');
    assert.equal(json.usage.total_tokens, 7);
    const log = JSON.parse(readFileSync(fakeCliLog, 'utf8'));
    assert.equal(log.input, 'What happened?');
    assert.ok(log.argv.includes('-p'));
    assert.deepEqual(log.argv.slice(log.argv.indexOf('--tools'), log.argv.indexOf('--tools') + 2), ['--tools', '']);
    assert.equal(log.argv[log.argv.indexOf('--system-prompt') + 1], 'You are an analyst.');
  });

  test('admin API never returns stored keys and persists with 0600', async () => {
    const resp = await fetch(`${base}/admin/api/state`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const state = await resp.json();
    const raw = JSON.stringify(state);
    for (const secret of ['sk-good', 'sk-or', 'sk-ant']) assert.ok(!raw.includes(secret), `${secret} leaked`);

    // Save without keys: stored keys must be preserved.
    const providers = state.providers.map((p) => ({ ...p, originalId: p.id }));
    const put = await fetch(`${base}/admin/api/config`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ providers, routes: state.routes }),
    });
    assert.equal(put.status, 200);
    const file = join(dir, 'ai-port.json');
    assert.equal(statSync(file).mode & 0o777, 0o600);
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(saved.providers.find((p) => p.id === 'good').apiKey, 'sk-good');
  });

  test('model listing for OpenAI-compatible providers', async () => {
    const resp = await fetch(`${base}/admin/api/models`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'good' }),
    });
    assert.deepEqual((await resp.json()).models, ['a-model', 'b-model']);
  });

  test('root answers World Monitor reachability probes', async () => {
    const resp = await fetch(base);
    assert.equal(resp.status, 200);
  });
});

describe('request translation units', () => {
  test('OpenAI reasoning models get max_completion_tokens and no temperature', () => {
    const provider = normalizeProvider({ preset: 'openai', apiKey: 'k' });
    const body = buildRequestBody(provider, { messages: [], max_tokens: 500, temperature: 0.3 }, 'gpt-5-mini');
    assert.equal(body.max_completion_tokens, 500);
    assert.equal(body.max_tokens, undefined);
    assert.equal(body.temperature, undefined);
  });

  test('Anthropic message conversion handles tools, images and ordering', () => {
    const { system, messages } = convertMessages([
      { role: 'assistant', content: 'earlier' },
      { role: 'user', content: [{ type: 'text', text: 'look' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }] },
      { role: 'assistant', content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'f', arguments: '{"a":1}' } }] },
      { role: 'tool', tool_call_id: 't1', content: 'result' },
      { role: 'system', content: 'sys' },
    ]);
    assert.equal(system, 'sys');
    assert.equal(messages[0].role, 'user', 'conversation must start with user');
    assert.equal(messages.at(-1).role, 'user');
    const img = messages.flatMap((m) => m.content).find((b) => b.type === 'image');
    assert.deepEqual(img.source, { type: 'base64', media_type: 'image/png', data: 'AAAA' });
    const toolUse = messages.flatMap((m) => m.content).find((b) => b.type === 'tool_use');
    assert.deepEqual(toolUse.input, { a: 1 });
    assert.ok(messages.flatMap((m) => m.content).some((b) => b.type === 'tool_result' && b.tool_use_id === 't1'));
  });

  test('Anthropic first-party requests enable the refusal fallback; older models keep temperature', () => {
    const provider = normalizeProvider({ preset: 'anthropic', apiKey: 'k' });
    const modern = buildParams(provider, { messages: [{ role: 'user', content: 'x' }], temperature: 0.5 }, 'claude-opus-5-5');
    assert.equal(modern.fallbacks, 'default');
    assert.deepEqual(modern.betas, ['server-side-fallback-2026-07-01']);
    assert.equal(modern.temperature, undefined);

    const haiku = buildParams(provider, { messages: [{ role: 'user', content: 'x' }], temperature: 0.5, max_tokens: 200 }, 'claude-haiku-4-5');
    assert.equal(haiku.temperature, 0.5);
    assert.equal(haiku.max_tokens, 200);
    assert.equal(haiku.output_config, undefined);
    assert.equal(haiku.fallbacks, undefined);

    const forced = buildParams(provider, {
      messages: [{ role: 'user', content: 'x' }],
      tools: [{ type: 'function', function: { name: 'f', parameters: { type: 'object' } } }],
      tool_choice: 'required',
    }, 'claude-opus-5-5');
    assert.deepEqual(forced.tool_choice, { type: 'auto' });
  });
});
