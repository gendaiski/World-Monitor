import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { aiPortChainEntry, aiPortChatUrl } from '../scripts/lib/ai-port-provider.mjs';
import { callLlmDefault, __setNarrativeTransportForTests } from '../scripts/regional-snapshot/narrative.mjs';

const KEYS = ['OPENROUTER_API_KEY', 'AI_PORT_TOKEN', 'AI_PORT_URL', 'AI_PORT_MODEL'];
const originalEnv = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  __setNarrativeTransportForTests(null);
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('AI Port seeder chain entry', () => {
  it('reads its URL and model at call time', () => {
    delete process.env.AI_PORT_URL;
    delete process.env.AI_PORT_MODEL;
    const entry = aiPortChainEntry({ userAgent: 'ua', timeout: 1000 });
    assert.equal(entry.apiUrl, 'http://localhost:8787/v1/chat/completions');
    assert.equal(entry.model, 'auto');
    process.env.AI_PORT_URL = 'http://ai-port:8787/';
    process.env.AI_PORT_MODEL = 'fast';
    assert.equal(entry.apiUrl, 'http://ai-port:8787/v1/chat/completions');
    assert.equal(entry.model, 'fast');
    assert.equal(entry.envKey, 'AI_PORT_TOKEN');
    assert.equal(entry.headers('tok').Authorization, 'Bearer tok');
    assert.equal(aiPortChatUrl({ AI_PORT_URL: 'https://x.example' }), 'https://x.example/v1/chat/completions');
  });

  it('regional narrative uses the AI Port when no OpenRouter key is set', async () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.AI_PORT_TOKEN = 'port-token';
    process.env.AI_PORT_URL = 'http://ai-port.test:8787';
    const calls = [];
    __setNarrativeTransportForTests({
      fetch: async (url, init) => {
        calls.push({ url: String(url), auth: init.headers.Authorization, body: JSON.parse(init.body) });
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ model: 'auto', choices: [{ message: { content: '{"situation":"ok"}' } }] }),
        };
      },
    });

    const result = await callLlmDefault({ systemPrompt: 's', userPrompt: 'u' }, { retryDelayMs: 0 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://ai-port.test:8787/v1/chat/completions');
    assert.equal(calls[0].auth, 'Bearer port-token');
    assert.equal(calls[0].body.model, 'auto');
    assert.equal(result?.provider, 'ai-port');
  });

  it('stays inactive without AI_PORT_TOKEN', async () => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.AI_PORT_TOKEN;
    let called = false;
    __setNarrativeTransportForTests({ fetch: async () => { called = true; throw new Error('unexpected'); } });
    const result = await callLlmDefault({ systemPrompt: 's', userPrompt: 'u' }, { retryDelayMs: 0 });
    assert.equal(called, false);
    assert.equal(result, null);
  });
});
