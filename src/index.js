/** An actionable error from the local bridge or its transport. */
export class OwnferenceError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'OwnferenceError';
    this.code = code;
    if (options.status !== undefined) this.status = options.status;
  }
}

const MAX_LINE = 1024 * 1024;
const protocol = (message, cause) => new OwnferenceError('PROTOCOL_ERROR', message, { cause });

/** Create a client. Tokens are held only in this client's memory. */
export function createClient({ token, baseUrl = 'http://127.0.0.1:3210', fetch: fetchImpl = globalThis.fetch } = {}) {
  if (typeof token !== 'string' || !token.trim()) throw new OwnferenceError('INVALID_TOKEN', 'Enter a bridge token first.');
  let url;
  try { url = new URL(baseUrl); } catch { throw new OwnferenceError('INVALID_URL', 'Bridge URL must be an HTTP loopback origin.'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new OwnferenceError('INVALID_URL', 'Bridge URL must be an HTTP loopback origin such as http://127.0.0.1:3210.');
  }
  if (typeof fetchImpl !== 'function') throw new OwnferenceError('FETCH_UNAVAILABLE', 'This environment does not provide fetch.');
  const origin = url.origin;
  async function request(path, init, signal) {
    let response;
    try {
      response = await fetchImpl(origin + path, { ...init, signal, redirect: 'error', headers: { Authorization: `Bearer ${token}`, ...init.headers } });
    } catch (cause) {
      if (signal?.aborted || cause?.name === 'AbortError') throw new OwnferenceError('ABORTED', 'Request cancelled.', { cause });
      throw new OwnferenceError('NETWORK_ERROR', 'Cannot reach the local bridge. Check that it is running, this exact page origin is granted, and your browser permits local network access.', { cause });
    }
    if (!response.ok) {
      let body;
      try { body = await response.json(); } catch (cause) {
        if (signal?.aborted || cause?.name === 'AbortError') throw new OwnferenceError('ABORTED', 'Request cancelled.', { cause });
        /* A non-JSON error still has a useful HTTP status. */
      }
      const error = body?.error;
      throw new OwnferenceError(typeof error?.code === 'string' ? error.code : 'HTTP_ERROR', typeof error?.message === 'string' ? error.message : `Bridge returned HTTP ${response.status}. Check the token and origin grant.`, { status: response.status });
    }
    return response;
  }
  return {
    async models({ signal } = {}) {
      const response = await request('/v1/models', {}, signal);
      let data;
      try { data = await response.json(); } catch (cause) {
        if (signal?.aborted) throw new OwnferenceError('ABORTED', 'Request cancelled.', { cause });
        throw protocol('Bridge returned invalid model JSON.', cause);
      }
      if (!Array.isArray(data?.models) || data.models.some(m => !m || typeof m.id !== 'string' || typeof m.name !== 'string' || typeof m.provider !== 'string')) throw protocol('Bridge returned an invalid model list.');
      return data;
    },
    async *generate(input, { signal } = {}) {
      const response = await request('/v1/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }, signal);
      if (!response.body || !response.headers.get('content-type')?.toLowerCase().startsWith('application/x-ndjson')) throw protocol('Bridge did not return an NDJSON stream.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let buffer = '', done = false, exhausted = false;
      function parse(line) {
        if (!line.trim()) throw protocol('Bridge sent an empty NDJSON record.');
        let item;
        try { item = JSON.parse(line); } catch (cause) { throw protocol('Bridge sent invalid NDJSON.', cause); }
        if (done) throw protocol('Bridge sent data after the terminal record.');
        if (item?.type === 'delta' && typeof item.text === 'string') return item.text;
        if (item?.type === 'done') { done = true; return null; }
        if (item?.type === 'error' && typeof item.error?.code === 'string' && typeof item.error?.message === 'string') throw new OwnferenceError(item.error.code, item.error.message);
        throw protocol('Bridge sent an invalid stream record.');
      }
      try {
        while (true) {
          const chunk = await reader.read();
          try {
            if (chunk.done) { exhausted = true; buffer += decoder.decode(); } else buffer += decoder.decode(chunk.value, { stream: true });
          } catch (cause) { throw protocol('Could not decode the bridge stream as UTF-8.', cause); }
          let newline;
          while ((newline = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
            if (line.length > MAX_LINE) throw protocol('Bridge stream record is too large.');
            const text = parse(line.endsWith('\r') ? line.slice(0, -1) : line);
            if (text !== null) yield text;
          }
          if (buffer.length > MAX_LINE) throw protocol('Bridge stream record is too large.');
          if (chunk.done) break;
        }
        if (buffer.length) throw protocol('Bridge stream ended with an incomplete NDJSON record.');
        if (!done) throw protocol('Bridge stream ended before its terminal record.');
      } catch (cause) {
        if (cause instanceof OwnferenceError) throw cause;
        if (signal?.aborted || cause?.name === 'AbortError') throw new OwnferenceError('ABORTED', 'Request cancelled.', { cause });
        throw new OwnferenceError('NETWORK_ERROR', 'The connection to the local bridge was interrupted. Check that the bridge and local model are running, then retry.', { cause });
      } finally {
        if (!exhausted) { try { await reader.cancel(); } catch { /* stream already closed */ } }
        reader.releaseLock();
      }
    }
  };
}

/** Connect to the user-approved Ownference Tabs relay without exposing a token. */
export function createRelayClient() {
  let port, connecting, sequence = 0;
  const pending = new Map();
  const aborted = () => new OwnferenceError('ABORTED', 'Request cancelled.');
  const unavailable = () => new OwnferenceError('RELAY_UNAVAILABLE', 'Open Ownference Tabs and choose Enable relay for this site, then connect again.');
  const remoteError = error => typeof error?.code === 'string' && typeof error?.message === 'string'
    ? new OwnferenceError(error.code, error.message) : protocol('Relay sent an invalid error.');
  function failAll(error) {
    for (const request of pending.values()) request.finish(error);
    pending.clear();
  }
  function disconnect() {
    if (connecting) connecting.cancel();
    if (port) {
      try { port.postMessage({ op: 'disconnect' }); } catch { /* Already closed. */ }
      port.close(); port = undefined;
    }
    failAll(new OwnferenceError('RELAY_DISCONNECTED', 'Relay disconnected. Connect again after enabling this site.'));
  }
  async function connect() {
    if (port) return;
    if (connecting) return connecting.promise;
    if (typeof window === 'undefined' || window.top !== window || !['http:', 'https:'].includes(window.location.protocol) || window.location.origin === 'null' || typeof MessageChannel === 'undefined') {
      throw new OwnferenceError('RELAY_CONTEXT', 'Relay requires a top-level HTTP(S) page with a non-opaque origin.');
    }
    const channel = new MessageChannel();
    let cancel;
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(unavailable()), 2000);
      function finish(error) {
        clearTimeout(timer);
        connecting = undefined;
        if (error) { channel.port1.close(); channel.port2.close(); reject(error); }
        else {
          port = channel.port1;
          port.onmessage = onMessage;
          port.onmessageerror = () => { failAll(protocol('Relay sent an unreadable message.')); disconnect(); };
          port.onclose = () => {
            if (port === channel.port1) {
              port = undefined;
              failAll(new OwnferenceError('RELAY_DISCONNECTED', 'Relay disconnected. Connect again after enabling this site.'));
            }
          };
          resolve();
        }
      }
      cancel = (error = new OwnferenceError('RELAY_DISCONNECTED', 'Relay connection cancelled.')) => finish(error);
      channel.port1.onmessage = ({ data }) => {
        if (data?.type === 'ready') finish();
        else if (data?.type === 'error') finish(remoteError(data.error));
        else finish(protocol('Relay sent an invalid handshake.'));
      };
      channel.port1.onmessageerror = () => finish(protocol('Relay sent an unreadable handshake.'));
    });
    connecting = { promise, cancel };
    try {
      window.postMessage({ source: 'ownference-page', type: 'connect', version: 1 }, window.location.origin, [channel.port2]);
    } catch (cause) { cancel(new OwnferenceError('RELAY_UNAVAILABLE', unavailable().message, { cause })); }
    return promise;
  }
  function onMessage({ data }) {
    if (data?.type === 'error' && data.id === undefined) {
      failAll(remoteError(data.error));
      disconnect();
      return;
    }
    const request = pending.get(data?.id);
    if (!request) return;
    if (data.event === 'error') request.finish(remoteError(data.error));
    else if (request.op === 'models' && data.event === 'models') {
      if (!Array.isArray(data.data?.models) || data.data.models.some(m => !m || typeof m.id !== 'string' || typeof m.name !== 'string' || typeof m.provider !== 'string')) request.finish(protocol('Relay returned an invalid model list.'));
      else request.finish(null, data.data);
    } else if (request.op === 'generate' && data.event === 'delta' && typeof data.text === 'string') request.push(data.text);
    else if (request.op === 'generate' && data.event === 'done') request.finish();
    else request.finish(protocol('Relay sent an invalid response.'));
  }
  function start(op, input, signal) {
    if (!port) throw new OwnferenceError('RELAY_DISCONNECTED', 'Connect to the relay first.');
    if (signal?.aborted) throw aborted();
    const id = String(++sequence);
    const queue = [];
    let wake, terminal = false, failure;
    const notify = () => { if (wake) { const resolve = wake; wake = undefined; resolve(); } };
    const cancel = () => {
      if (!terminal && port) {
        try { port.postMessage({ id: String(++sequence), op: 'cancel', target: id }); } catch { /* Already closed. */ }
      }
      if (!terminal) queue.length = 0;
      request.finish(aborted());
    };
    const request = {
      op,
      push(value) { queue.push(value); notify(); },
      finish(error, value) {
        if (terminal) return;
        terminal = true;
        failure = error;
        if (value !== undefined) queue.push(value);
        pending.delete(id);
        signal?.removeEventListener('abort', cancel);
        notify();
      },
      cancel,
      async next() {
        while (!queue.length && !terminal) await new Promise(resolve => { wake = resolve; });
        if (queue.length) return { value: queue.shift(), done: false };
        if (failure) throw failure;
        return { done: true };
      }
    };
    pending.set(id, request);
    signal?.addEventListener('abort', cancel, { once: true });
    try { port.postMessage(op === 'generate' ? { id, op, input } : { id, op }); }
    catch (cause) { request.finish(new OwnferenceError('RELAY_DISCONNECTED', 'Relay connection failed.', { cause })); }
    return request;
  }
  return {
    connect,
    disconnect,
    async models({ signal } = {}) {
      const request = start('models', undefined, signal);
      return (await request.next()).value;
    },
    async *generate(input, { signal } = {}) {
      const request = start('generate', input, signal);
      try {
        while (true) {
          const item = await request.next();
          if (item.done) return;
          yield item.value;
        }
      } finally { request.cancel(); }
    }
  };
}
