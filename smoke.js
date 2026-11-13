import { createClient } from './src/index.js';
const token = process.env.OWNFERENCE_TOKEN;
if (!token) { console.error('Set OWNFERENCE_TOKEN to an origin-grant token; start Ownference and Ollama first.'); process.exit(1); }
const client = createClient({ token, baseUrl: process.env.OWNFERENCE_URL || 'http://127.0.0.1:3210' });
try {
  const { models } = await client.models();
  const model = process.env.OWNFERENCE_MODEL || models.find(m => m.provider === 'ollama')?.id;
  if (!model || !models.some(m => m.id === model && m.provider === 'ollama')) throw new Error('No requested Ollama model was discovered. Start Ollama and pull a model.');
  console.log(`Using ${model}`);
  let output = '';
  for await (const delta of client.generate({ model, task: 'summarize', text: 'A local model runs on your own machine. It answers without sending this text to a cloud service.' }, { signal: AbortSignal.timeout(120000) })) { output += delta; process.stdout.write(delta); }
  if (!output.trim()) throw new Error('Model returned an empty response.');
  console.log('\nLive Ollama smoke passed.');
} catch (error) { console.error(`Live smoke failed: ${error.message}`); process.exitCode = 1; }
