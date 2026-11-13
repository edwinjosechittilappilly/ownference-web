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
