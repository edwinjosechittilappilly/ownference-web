import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRelayClient, OwnModeError } from '../src/index.js';

const input = { model: 'ollama:test', task: 'summarize', text: 'hello' };
const models = { models: [{ id: 'ollama:test', name: 'Test', provider: 'ollama' }] };
async function collect(stream) { let text = ''; for await (const part of stream) text += part; return text; }
async function fixture(handler, run) {
  const previous = globalThis.window;
  let peer;
  const peers = [];
  const window = {
    location: { protocol: 'https:', origin: 'https://example.test' },
    postMessage(message, origin, ports) {
      assert.deepEqual(message, { source: 'ownmode-page', type: 'connect', version: 1 });
      assert.equal(origin, 'https://example.test');
      peer = ports[0];
      peers.push(peer);
      handler(peer);
    }
  };
  window.top = window;
  globalThis.window = window;
  try { await run(window, () => peer); }
  finally { for (const port of peers) port.close(); if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
}

test('relay discovers models and streams through the transferred port', async () => {
  await fixture(port => {
    port.onmessage = ({ data }) => {
      if (data.op === 'models') port.postMessage({ id: data.id, event: 'models', data: models });
      if (data.op === 'generate') {
        assert.deepEqual(data.input, input);
        port.postMessage({ id: data.id, event: 'delta', text: 'hello ' });
        port.postMessage({ id: data.id, event: 'delta', text: 'world' });
        port.postMessage({ id: data.id, event: 'done' });
      }
    };
    port.postMessage({ type: 'ready' });
  }, async () => {
    const client = createRelayClient();
    await Promise.all([client.connect(), client.connect()]);
    assert.deepEqual(await client.models(), models);
    assert.equal(await collect(client.generate(input)), 'hello world');
    client.disconnect();
    await assert.rejects(client.models(), e => e.code === 'RELAY_DISCONNECTED');
  });
});

test('relay preserves remote errors and rejects invalid responses', async () => {
  await fixture(port => {
    port.onmessage = ({ data }) => {
      if (data.op === 'models') port.postMessage({ id: data.id, event: 'models', data: { models: [{}] } });
      if (data.op === 'generate') port.postMessage({ id: data.id, event: 'error', error: { code: 'NATIVE_UNAVAILABLE', message: 'Install native host' } });
    };
    port.postMessage({ type: 'ready' });
  }, async () => {
    const client = createRelayClient(); await client.connect();
    await assert.rejects(client.models(), e => e.code === 'PROTOCOL_ERROR');
    await assert.rejects(collect(client.generate(input)), e => e instanceof OwnModeError && e.code === 'NATIVE_UNAVAILABLE');
    client.disconnect();
  });
});

test('aborting and returning streams send scoped cancel requests', async () => {
  await fixture(port => {
    port.onmessage = ({ data }) => {
      if (data.op === 'generate') port.postMessage({ id: data.id, event: 'delta', text: 'first' });
    };
    port.postMessage({ type: 'ready' });
  }, async (_window, getPeer) => {
    const client = createRelayClient(); await client.connect();
    const controller = new AbortController();
    const stream = client.generate(input, { signal: controller.signal });
    assert.equal((await stream.next()).value, 'first');
    const cancelled = new Promise(resolve => { getPeer().onmessage = ({ data }) => { if (data.op === 'cancel') resolve(data); }; });
    controller.abort();
    await assert.rejects(stream.next(), e => e.code === 'ABORTED');
    assert.equal((await cancelled).target, '1');
    controller.abort();
    client.disconnect();
  });
});

test('disconnect fails pending work and tells the relay to stop', async () => {
  await fixture(port => { port.postMessage({ type: 'ready' }); }, async (_window, getPeer) => {
    const client = createRelayClient(); await client.connect();
    const pending = client.models();
    const disconnected = new Promise(resolve => { getPeer().onmessage = ({ data }) => { if (data.op === 'disconnect') resolve(); }; });
    client.disconnect();
    await assert.rejects(pending, e => e.code === 'RELAY_DISCONNECTED');
    await disconnected;
  });
});

test('rejects unapproved handshakes, invalid frames and unsafe contexts', async () => {
  await fixture(port => port.postMessage({ type: 'error', error: { code: 'DENIED', message: 'Not enabled' } }), async () => {
    await assert.rejects(createRelayClient().connect(), e => e.code === 'DENIED');
  });
  await fixture(port => port.postMessage({ type: 'unexpected' }), async () => {
    await assert.rejects(createRelayClient().connect(), e => e.code === 'PROTOCOL_ERROR');
  });
  await fixture(() => {}, async window => {
    window.top = {};
    await assert.rejects(createRelayClient().connect(), e => e.code === 'RELAY_CONTEXT');
    window.top = window; window.location.origin = 'null';
    await assert.rejects(createRelayClient().connect(), e => e.code === 'RELAY_CONTEXT');
  });
});

test('missing extension times out with actionable instructions and allows retry', async () => {
  let attempts = 0;
  await fixture(port => { if (++attempts === 2) port.postMessage({ type: 'ready' }); }, async () => {
    const client = createRelayClient();
    await assert.rejects(client.connect(), e => e.code === 'RELAY_UNAVAILABLE' && /Enable relay for this site/.test(e.message));
    await client.connect(); client.disconnect();
  });
});

test('early iterator return cancels generation and disconnect propagates errors', async () => {
  await fixture(port => {
    port.onmessage = ({ data }) => {
      if (data.op === 'generate') port.postMessage({ id: data.id, event: 'delta', text: 'part' });
    };
    port.postMessage({ type: 'ready' });
  }, async (_window, getPeer) => {
    const client = createRelayClient(); await client.connect();
    const stream = client.generate(input);
    assert.equal((await stream.next()).value, 'part');
    const cancelled = new Promise(resolve => { getPeer().onmessage = ({ data }) => { if (data.op === 'cancel') resolve(data); }; });
    await stream.return();
    assert.equal((await cancelled).target, '1');
    const pending = client.models();
    getPeer().postMessage({ type: 'error', error: { code: 'REVOKED', message: 'Access revoked' } });
    await assert.rejects(pending, e => e.code === 'REVOKED');
  });
});

test('invalid relay events and aborted model requests fail safely', async () => {
  await fixture(port => {
    port.onmessage = ({ data }) => {
      if (data.op === 'generate') port.postMessage({ id: data.id, event: 'delta', text: 123 });
    };
    port.postMessage({ type: 'ready' });
  }, async () => {
    const client = createRelayClient(); await client.connect();
    await assert.rejects(collect(client.generate(input)), e => e.code === 'PROTOCOL_ERROR');
    const controller = new AbortController();
    const pending = client.models({ signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, e => e.code === 'ABORTED');
    await assert.rejects(client.models({ signal: controller.signal }), e => e.code === 'ABORTED');
    client.disconnect();
  });
});
