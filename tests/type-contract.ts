import { createClient, createRelayClient, OwnferenceError, type Client, type GenerateInput } from '../src/index.js';
async function consumer(client: Client, input: GenerateInput, signal: AbortSignal): Promise<string> {
  const models = await client.models({ signal });
  const model: string | undefined = models.models[0]?.id;
  let result = model || '';
  for await (const text of client.generate(input, { signal })) result += text;
  return result;
}
function declarations() {
  const client = createClient({ token: 'provided-at-runtime', fetch: globalThis.fetch });
  const relay = createRelayClient();
  void relay.connect().then(() => consumer(relay, { model: 'ollama:test', task: 'draft', text: 'text' }, new AbortController().signal)).finally(() => relay.disconnect());
  void consumer(client, { model: 'ollama:test', task: 'summarize', text: 'user text' }, new AbortController().signal);
  // @ts-expect-error Unsupported tasks must not typecheck for consumers.
  client.generate({ model: 'ollama:test', task: 'execute_shell', text: 'untrusted' });
  const error = new OwnferenceError('NETWORK_ERROR', 'Bridge unreachable', { cause: new Error('reset'), status: 502 });
  const code: string = error.code;
  return code;
}
void declarations;
