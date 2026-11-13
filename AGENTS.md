# Development

## Repository map

`src/` is the browser SDK and public TypeScript declarations. `public/` is the cooperating frontend; `server.js` serves only allowed assets. `tests/` verifies streaming, failures, consumer types and safe rendering.

## Commands and verification

Use Node 24 and `npm ci`. `npm run check` runs ESLint, secret scanning, strict consumer typechecking and coverage-gated tests. `npm start` serves the demo. README documents `npm run smoke` with a running real bridge/Ollama; browser UI changes require real browser acceptance.

## Conventions and boundaries

No runtime dependencies. Preserve exact-origin authorization, memory-only tokens, strict streaming termination, cancellation and text-only rendering. Never embed user credentials, persist prompts or promise universal hosted-browser compatibility. Development minimatch overrides patch GHSA-g3hv-75wg-m249; review before updating.

## Workflow

Plan consumer behavior, cover plausible failures, implement, review, verify and update CHANGELOG/docs. Conventional commits; PR template must include observed results. Do not weaken checks or claim unobserved model/browser success.
