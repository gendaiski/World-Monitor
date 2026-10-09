import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPrompt, findItem, KINDS, pickProvider, writeBrief } from '../api/brief.js';

const layers = JSON.parse(readFileSync(new URL('../data/layers.json', import.meta.url), 'utf8'));

describe('situation map brief API', () => {
  test('every briefable item has a unique id within its kind', () => {
    for (const [kind, [key]] of Object.entries(KINDS)) {
      const ids = layers[key].map((item) => item.id);
      assert.ok(ids.every((id) => typeof id === 'string' && id.length > 0), `${kind} has items without ids`);
      assert.equal(new Set(ids).size, ids.length, `${kind} has duplicate ids`);
    }
  });

  test('looks items up only in the curated data', () => {
    assert.equal(findItem('conflict', 'iran').name, 'Iran War Theater');
    assert.equal(findItem('conflict', 'not-a-real-id'), null);
    assert.equal(findItem('__proto__', 'iran'), null);
    assert.equal(findItem('conflict', 'x'.repeat(500)), null);
  });

  test('prompt carries the item data but not map geometry', () => {
    const prompt = buildPrompt('conflict', findItem('conflict', 'iran'));
    assert.match(prompt, /Iran War Theater/);
    assert.match(prompt, /using ONLY the data given/);
    assert.doesNotMatch(prompt, /"coords"/);
    assert.doesNotMatch(prompt, /"keywords"/);
  });

  test('picks Anthropic first, then any OpenAI-compatible endpoint', () => {
    assert.equal(pickProvider({}), null);
    assert.deepEqual(pickProvider({ ANTHROPIC_API_KEY: 'k' }), { kind: 'anthropic', apiKey: 'k', model: 'claude-opus-5-5' });
    assert.equal(pickProvider({ AI_BASE_URL: 'https://x.test/v1/', AI_MODEL: 'm' }).baseUrl, 'https://x.test/v1');
    assert.equal(pickProvider({ AI_BASE_URL: 'https://x.test/v1' }), null, 'a model is required');
  });

  test('answers 503 with a setup hint when no AI is connected', async () => {
    const r = await writeBrief('conflict', 'iran', { env: {} });
    assert.equal(r.status, 503);
    assert.equal(r.body.error, 'no_ai');
    assert.ok(!r.cache);
  });

  test('answers 404 for unknown items without calling an AI', async () => {
    let called = false;
    const r = await writeBrief('base', 'nope', { env: { AI_BASE_URL: 'https://x.test/v1', AI_MODEL: 'm' }, fetchImpl: async () => { called = true; } });
    assert.equal(r.status, 404);
    assert.equal(called, false);
  });

  test('writes a cacheable brief through an OpenAI-compatible endpoint', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ model: 'auto', choices: [{ message: { content: 'Bottom line: test brief.' } }] }), { status: 200 });
    };
    const r = await writeBrief('waterway', 'taiwan_strait', { env: { AI_BASE_URL: 'http://ai-port.test:8787/v1', AI_API_KEY: 'tok', AI_MODEL: 'auto' }, fetchImpl });
    assert.equal(r.status, 200);
    assert.equal(r.body.text, 'Bottom line: test brief.');
    assert.equal(r.cache, true);
    assert.equal(calls[0].url, 'http://ai-port.test:8787/v1/chat/completions');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
    assert.match(JSON.parse(calls[0].init.body).messages[0].content, /TAIWAN STRAIT/);
  });

  test('does not cache provider failures', async () => {
    const fetchImpl = async () => new Response('busy', { status: 429 });
    const r = await writeBrief('hotspot', 'sahel', { env: { AI_BASE_URL: 'https://x.test/v1', AI_MODEL: 'm' }, fetchImpl });
    assert.equal(r.status, 502);
    assert.ok(!r.cache);
  });
});
