import { createClient } from '/sdk.js';
const $ = id => document.getElementById(id);
const el = Object.fromEntries(['token','connect-form','connect','disconnect','connection-status','origin','model','task','text','instruction','generate-form','generate','cancel','clear','output','copy','download','status'].map(id => [id, $(id)]));
let client = null, controller = null, connectionController = null, connecting = false, epoch = 0;
el.origin.textContent = location.origin;
function status(message) { el.status.textContent = message; }
function refresh() {
  const busy = Boolean(controller) || connecting;
  el.connect.disabled = busy;
  el.disconnect.disabled = !client && !busy;
  el.model.disabled = !client || busy;
  el.generate.disabled = !client || busy || !el.model.value;
  el.cancel.disabled = !controller;
  el.copy.disabled = !el.output.textContent;
  el.download.disabled = !el.output.textContent;
}
function disconnect() {
  epoch++; controller?.abort(); connectionController?.abort(); controller = null; connectionController = null; connecting = false; client = null;
  el.token.value = ''; el.model.replaceChildren(new Option('Connect to find models', ''));
  el['connection-status'].textContent = 'Not connected'; refresh();
}
el['connect-form'].addEventListener('submit', async event => {
  event.preventDefault(); if (connecting || controller) return;
  const token = el.token.value.trim();
  disconnect();
  const current = ++epoch;
  connecting = true; connectionController = new AbortController(); refresh(); status('Connecting to your local bridge…');
  try {
    const next = createClient({ token });
    const result = await next.models({ signal: connectionController.signal });
    if (current !== epoch) return;
    client = next;
    el.model.replaceChildren(new Option(result.models.length ? 'Choose a model' : 'No models available', ''));
    for (const model of result.models) el.model.add(new Option(`${model.name} · ${model.provider}`, model.id));
    if (result.models.length) el.model.selectedIndex = 1;
    el['connection-status'].textContent = 'Connected';
    const unavailable = (result.providers || []).filter(p => !p.available).map(p => `${p.id}: ${p.reason || 'unavailable'}`);
    status(result.models.length ? `Found ${result.models.length} model${result.models.length === 1 ? '' : 's'}.${unavailable.length ? ` ${unavailable.join('; ')}` : ''}` : `No models available. ${unavailable.join('; ')}`);
  } catch (error) { if (current === epoch) status(error.message); }
  finally { if (current === epoch) { connecting = false; connectionController = null; refresh(); } }
});
el.disconnect.addEventListener('click', () => { disconnect(); status('Disconnected.'); });
el.model.addEventListener('change', refresh);
el['generate-form'].addEventListener('submit', async event => {
  event.preventDefault(); if (!client || controller || !el.model.value) return;
  const current = ++epoch, active = new AbortController(); controller = active;
  el.output.textContent = ''; refresh(); status('Generating locally…');
  try {
    for await (const text of client.generate({ model: el.model.value, task: el.task.value, text: el.text.value, instruction: el.instruction.value }, { signal: active.signal })) {
      if (current !== epoch) break;
      el.output.textContent += text; refresh();
    }
    if (current === epoch) status('Finished.');
  } catch (error) { if (current === epoch) status(error.message); }
  finally { if (current === epoch) { controller = null; refresh(); } }
});
el.cancel.addEventListener('click', () => controller?.abort());
el.clear.addEventListener('click', () => { if (controller) { epoch++; controller.abort(); controller = null; } el.text.value = ''; el.instruction.value = ''; el.output.textContent = ''; refresh(); status('Cleared.'); });
el.copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(el.output.textContent); status('Copied to clipboard.'); } catch { status('Clipboard unavailable. Select the result and copy it manually.'); } });
el.download.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([el.output.textContent], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'ownference-result.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
