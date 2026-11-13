import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('untrusted model text is rendered as text, never HTML', async () => {
  class Element {
    constructor() { this.value = ''; this.textContent = ''; this.disabled = false; this.listeners = {}; this.options = []; this.selectedIndex = 0; }
    set innerHTML(_) { throw new Error('Untrusted HTML insertion'); }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    replaceChildren(...options) { this.options = options; this.value = options[0]?.value || ''; }
    add(option) { this.options.push(option); this.value = option.value; }
    async fire(name) { await this.listeners[name]({ preventDefault() {} }); }
  }
  const elements = new Map();
  globalThis.document = { getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); } };
  globalThis.location = { origin: 'http://localhost:4173' };
  globalThis.Option = class { constructor(text, value) { this.text = text; this.value = value; } };
  globalThis.__testClient = () => ({ models: async () => ({ models: [{ id: 'test', name: '<img>', provider: 'ollama' }] }), async *generate() { yield '<img src=x onerror=alert(1)>'; } });
  try {
    const source = (await readFile(new URL('../public/app.js', import.meta.url), 'utf8')).replace("import { createClient } from '/sdk.js';", 'const createClient = globalThis.__testClient;');
    await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    elements.get('token').value = 'secret'; await elements.get('connect-form').fire('submit');
    elements.get('text').value = 'source'; await elements.get('generate-form').fire('submit');
    assert.equal(elements.get('output').textContent, '<img src=x onerror=alert(1)>');
    assert.equal(elements.get('token').value, '');
  } finally { delete globalThis.document; delete globalThis.location; delete globalThis.Option; delete globalThis.__testClient; }
});
