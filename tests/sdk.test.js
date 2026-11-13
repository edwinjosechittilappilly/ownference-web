import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createClient, OwnferenceError } from '../src/index.js';

async function fixture(handler, run) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
const input = { model: 'ollama:test', task: 'summarize', text: 'test' };
async function collect(stream) { let result = ''; for await (const delta of stream) result += delta; return result; }
test('discovers models and decodes arbitrarily fragmented UTF-8 NDJSON', async () => {
  await fixture((req, res) => {
    assert.equal(req.headers.authorization, 'Bearer secret');
    if (req.url === '/v1/models') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ models: [{ id: 'ollama:test', provider: 'ollama', name: 'Test' }] })); return; }
    res.setHeader('Content-Type', 'application/x-ndjson');
    const bytes = Buffer.from('{"type":"delta","text":"Hi 🌍"}\r\n{"type":"delta","text":"!"}\n{"type":"done"}\n');
    for (const byte of bytes) res.write(Buffer.from([byte])); res.end();
  }, async baseUrl => {
    const client = createClient({ token: 'secret', baseUrl });
    assert.equal((await client.models()).models[0].id, 'ollama:test');
    assert.equal(await collect(client.generate(input)), 'Hi 🌍!');
  });
});
test('reports HTTP and in-stream errors with typed details', async () => {
  await fixture((req, res) => {
    if (req.url === '/v1/models') { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end('{"error":{"code":"DENIED","message":"Grant origin"}}'); }
    else { res.writeHead(200, { 'Content-Type': 'application/x-ndjson' }); res.end('{"type":"error","error":{"code":"OFFLINE","message":"Start Ollama"}}\n'); }
  }, async baseUrl => {
    const client = createClient({ token: 'x', baseUrl });
    await assert.rejects(client.models(), e => e instanceof OwnferenceError && e.code === 'DENIED' && e.status === 403);
    await assert.rejects(collect(client.generate(input)), e => e instanceof OwnferenceError && e.code === 'OFFLINE');
  });
});
test('rejects malformed, truncated and unterminated streams', async () => {
  for (const payload of ['not json\n', '{"type":"delta","text":"a"}\n', '{"type":"done"}', '{"type":"done"}\n{"type":"delta","text":"late"}\n', '\n']) {
    await fixture((_req, res) => { res.writeHead(200, { 'Content-Type': 'application/x-ndjson' }); res.end(payload); }, async baseUrl => {
      await assert.rejects(collect(createClient({ token: 'x', baseUrl }).generate(input)), e => e.code === 'PROTOCOL_ERROR');
    });
  }
});

test('early iterator return cancels the underlying response', async () => {
  let close;
  const closed = new Promise(resolve => { close = resolve; });
  await fixture((_req, res) => {
    res.on('close', close);
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
    res.write('{"type":"delta","text":"first"}\n');
  }, async baseUrl => {
    const stream = createClient({ token: 'x', baseUrl }).generate(input);
    assert.equal((await stream.next()).value, 'first');
    await stream.return();
    await Promise.race([closed, new Promise((_, reject) => setTimeout(() => reject(new Error('response was not cancelled')), 2000))]);
  });
});

test('decodes UTF-8 split at every byte boundary', async () => {
  const bytes = new TextEncoder().encode('{"type":"delta","text":"🌍"}\n{"type":"done"}\n');
  const fetch = async () => new Response(new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close(); } }), { headers: { 'Content-Type': 'application/x-ndjson' } });
  assert.equal(await collect(createClient({ token: 'x', fetch }).generate(input)), '🌍');
});
test('distinguishes stream transport failures from invalid UTF-8', async () => {
  const reset = new TypeError('connection reset');
  const headers = { 'Content-Type': 'application/x-ndjson' };
  const failedFetch = async () => new Response(new ReadableStream({ start(controller) { controller.error(reset); } }), { headers });
  await assert.rejects(collect(createClient({ token: 'x', fetch: failedFetch }).generate(input)), e => e.code === 'NETWORK_ERROR' && e.cause === reset && /bridge.*retry/i.test(e.message));
  for (const bytes of [Uint8Array.of(0xff), Uint8Array.of(0xe2, 0x82)]) {
    const invalidFetch = async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }), { headers });
    await assert.rejects(collect(createClient({ token: 'x', fetch: invalidFetch }).generate(input)), e => e.code === 'PROTOCOL_ERROR' && /UTF-8/.test(e.message));
  }
});
test('abort interrupts an in-progress stream', async () => {
  await fixture((_req, res) => { res.writeHead(200, { 'Content-Type': 'application/x-ndjson' }); res.write('{"type":"delta","text":"first"}\n'); }, async baseUrl => {
    const controller = new AbortController();
    const iterator = createClient({ token: 'x', baseUrl }).generate(input, { signal: controller.signal });
    assert.equal((await iterator.next()).value, 'first'); controller.abort();
    await assert.rejects(iterator.next(), e => e.code === 'ABORTED');
  });
});
test('rejects non-loopback bridge destinations before sending credentials', () => {
  for (const baseUrl of ['https://example.com', 'http://127.0.0.1.evil.test', 'http://localhost:3210/path', 'http://user@localhost']) assert.throws(() => createClient({ token: 'secret', baseUrl }), e => e.code === 'INVALID_URL');
});
