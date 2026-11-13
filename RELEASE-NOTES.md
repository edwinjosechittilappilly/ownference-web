# OwnMode Web 0.3.0

Switch to your own AI. Local intelligence for your apps and browser.

The JavaScript SDK and a ready-to-run writing workspace, now named OwnMode Web.

## What's new

- Charcoal, paper and teal interface with a compact workspace and readable focus states.
- Runnable SDK integration and HTTPS npx/npm quickstarts.
- Direct and permissioned browser-relay connections remain explicit; relay needs no bridge token in the page.

[Try the workspace](https://github.com/edwinjosechittilappilly/ownmode-web/tree/v0.3.0#try-it) · [Integrate the SDK](https://github.com/edwinjosechittilappilly/ownmode-web/tree/v0.3.0#add-local-ai-to-your-app)


## Choose an asset

- `ownmode-web-0.3.0.tgz`: browser SDK and local demo, requiring Node.js 24+ for the demo or npm installation.
- `SHA256SUMS`: verify the downloaded tarball with `shasum -a 256 -c SHA256SUMS` in the download directory.

## Quick start

```sh
npx --yes --package https://github.com/edwinjosechittilappilly/ownmode-web/releases/download/v0.3.0/ownmode-web-0.3.0.tgz ownmode-web
```

For a durable demo command, run `npm install -g https://github.com/edwinjosechittilappilly/ownmode-web/releases/download/v0.3.0/ownmode-web-0.3.0.tgz`. To add the SDK to a project, use the same URL with `npm install` in that project. This is a GitHub release asset, not an npm registry publication. Connect to a separately configured OwnMode Connect or approved OwnMode Browser relay and a local model provider; there is no cloud fallback. Sites receiving output can transmit it elsewhere.

Upgrading from Ownference requires uninstalling its old startup service and native host, creating new origin grants and approving browser tabs again. Existing grants are not imported; update integrations to `@ownmode/web` and `OwnModeError`.
