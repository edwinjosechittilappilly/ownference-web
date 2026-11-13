<p align="center"><img src="docs/assets/logo.svg" width="88" alt="Ownference linked-loop logo with developer badge"></p>

# Ownference Web
### Their models. Your app.

A small JavaScript SDK that lets a cooperating frontend use **the visitor's local models**. Stream text through a direct loopback connection or an explicitly approved browser relay.

<p><a href="https://github.com/edwinjosechittilappilly/ownference-web/releases">Download releases</a> · <a href="#try-the-workspace">Try it</a> · <a href="#add-the-sdk">SDK quick start</a> · <a href="#two-transports-one-task-interface">Transport choice</a> · <a href="docs/architecture.md">Architecture</a></p>

![Ownference Web: their models, your app](docs/assets/hero.svg)

**Apache-2.0 · ESM + TypeScript declarations · No runtime npm dependencies · Private preview**

## Build something people use

- Put rewrite, summarize or draft beside the text—not in another chatbot tab.
- Let each visitor choose the local model they already trust.
- Show the result while it streams; cancel when the user changes direction.
- Keep a cloud inference account out of the critical path.

This is **cooperating frontend integration**, not universal interception of another company's AI backend.

## Try the workspace

Requires Node 24+, GitHub CLI with access to this private repository, and the running [Ownference bridge](https://github.com/edwinjosechittilappilly/ownference).

```sh
gh release download v0.2.0 \
  --repo edwinjosechittilappilly/ownference-web \
  --pattern ownference-web-0.2.0.tgz

npx --yes --package "$PWD/ownference-web-0.2.0.tgz" ownference-web
```

Open **http://localhost:4173**. For the direct connection, grant that exact origin in another terminal:

```sh
ownference grant --origin http://localhost:4173
```

Paste the token, connect and choose a model. Try summarize, rewrite, extract, compare or draft. Preview, copy or download the answer; cancel, clear or disconnect at any time. The direct-mode token stays in page memory, not automatic persistent storage.

For a durable command instead of npx:

```sh
npm install -g ./ownference-web-0.2.0.tgz
ownference-web
```

These are **actual release tarballs**, not an assertion that `@ownference/web` is published on npm. Private release downloads require repository access.

## Add the SDK

From your frontend project, install the downloaded package:

```sh
npm install /absolute/path/to/ownference-web-0.2.0.tgz
```

### Browser relay: no bridge token in your page

The user installs [Ownference Tabs](https://github.com/edwinjosechittilappilly/ownference-tabs) and the native host, opens your page, and explicitly enables relay for that tab in the extension. Your UI then offers a Connect action:

```js
import { createRelayClient } from '@ownference/web';

const client = createRelayClient();
await client.connect(); // Call from your Connect UI after extension approval.
const { models } = await client.models();
if (!models.length) throw new Error('No local models are ready');

const cancel = new AbortController();
for await (const delta of client.generate({
  model: models[0].id,
  task: 'rewrite',
  text: 'The user-selected text goes here',
  instruction: 'Keep the original meaning. Use a friendly tone.'
}, { signal: cancel.signal })) {
  document.querySelector('#result').textContent += delta;
}

client.disconnect(); // Releases this page's relay connection.
```

Use `cancel.abort()` from your Cancel button. Do not render model text as HTML. Errors carry safe codes and messages; handle them visibly rather than silently falling back to a cloud model.

### Direct loopback: explicit origin token

```js
import { createClient } from '@ownference/web';

const token = document.querySelector('#token').value;
document.querySelector('#token').value = '';
const client = createClient({ token });
const { models } = await client.models();
```

The same `generate(input, {signal})` interface applies. A server-side request to localhost reaches **your server**, not your visitor's Mac.

## Two transports, one task interface

| | Direct loopback | Browser relay |
|---|---|---|
| Setup | Runtime + exact-origin token | Runtime + extension + native host |
| Page holds a bridge token | Yes, in memory | No |
| Approval | Local grant command | Extension-owned UI for the current document |
| Network path | Page fetches loopback | Page channel → extension → native host |
| Main limitation | Browser local-network/mixed-context policy | Chrome extension/native-host installation and document-scoped permission |

Neither path makes every website compatible, grants arbitrary OS actions or prevents the receiving website from transmitting the result. Permission is bound to the current document and restored after ordinary worker idleness; active work fails closed if its connection or worker is lost, without replay. Navigation or explicit revocation removes access, and browser/extension restart clears session grants.

## Interface at a glance

`models({signal?})` returns model IDs and provider availability. `generate({model, task, text, instruction?}, {signal?})` is an async iterable of text deltas. Relay adds `connect()` and `disconnect()`. Direct clients accept an optional loopback `baseUrl`.

Tasks are summarize, rewrite, extract, compare and draft. The runtime accepts up to 24,000 source characters and 2,000 instruction characters; individual model context windows can be smaller. Streaming validates UTF-8, NDJSON framing and terminal records, distinguishes network/protocol/provider errors, and cancels on early iterator exit.

## Privacy without the slogans

No telemetry, third-party CDN, cloud fallback, arbitrary URL fetching or model-executed tools. The selected local provider receives the prompt. Any website receiving output can send it elsewhere; local inference is not total data confinement.

Relay approval belongs to the origin/document, not an individual script: malicious same-origin code shares a granted site's privileges. Only ask users to enable relay on sites they trust. Browser policies may still prohibit extensions/native messaging.

## Develop and verify

```sh
npm ci
npm run check
npm start
```

Checks include lint, secret scanning, strict SDK consumer typechecking and coverage-gated behavior tests. The real-model smoke is documented in [testing](docs/testing.md); [verification](docs/verification.md) separates fixtures from actual model/browser runs. See [security](SECURITY.md) and [contributing](CONTRIBUTING.md).

**The family:** [Bridge](https://github.com/edwinjosechittilappilly/ownference) · [Web SDK](https://github.com/edwinjosechittilappilly/ownference-web) · [Tabs + Relay](https://github.com/edwinjosechittilappilly/ownference-tabs) · [Native Mac](https://github.com/edwinjosechittilappilly/ownference-mac)

Licensed under [Apache-2.0](LICENSE). A working brand, not trademark-cleared. Releases remain private until the owner approves public distribution.
