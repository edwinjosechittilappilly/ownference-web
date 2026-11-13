# Observed verification

## OwnMode Web 0.3.0 identity cutover

- `npm run check` passed: lint, secret scanning, strict declaration/consumer typechecking and all 19 behavior tests.
- Real Chromium exercised the renamed page-channel protocol through OwnMode Browser, native host and Connect to local Ollama.
- The actual HTTPS workspace connected with its token field empty/hidden, streamed a source-related result and disconnected. Direct page fetches to the bridge were blocked during this scenario.
- The charcoal/paper interface, shared split-O mark and readable product label were captured from the running workspace and visually inspected.
- Release installation and GitHub CI are separate from these source-checkout observations. A receiving website can transmit generated results elsewhere; npm registry publication is not claimed.

## Historical verification — Ownference 0.2.0

Historical record: these observations describe the pre-rebrand Ownference 0.2.0 software and are not verification of OwnMode 0.3.0.

Environment: Node24.10.0, real Chromium, the real Ownference bridge/native host and local `ollama:llama3.2:latest`.

- `npm run check`: 19 behavior tests passed with ESLint, Secretlint and strict declaration/consumer typechecking. Loaded SDK coverage measured 94.04% lines, 87.72% branches and 88.24% functions—not full browser UI coverage.
- Direct SDK streaming/error/cancellation/UTF-8 behavior remained covered; relay tests exercise channel connection, no-approval timeout, errors, cancellation, disconnect and unsafe-frame contexts.
- The packaged demo command served its own assets from an unrelated working directory, rather than depending on source checkout cwd.
- The real workspace's transport selector hid the direct token field in relay mode and connected without receiving a bridge token.
- A real HTTPS workspace page generated a source-related result through SDK → extension → native host → bridge → Ollama while its direct HTTP loopback requests were deliberately blocked.
- The HTTPS fixture used an ephemeral local self-signed certificate, accepted only in the isolated browser test context. This is not proof that every public HTTPS deployment/enterprise policy is supported.
- The visible result, source/model controls, connection status and shared branding were captured and visually inspected. Disconnect returned the page to Not connected.
- Prior direct-mode acceptance exercised all five tasks, copy/download, cancel, clear, disconnect and mobile layout, plus `apple:system` on-device summarization on this Mac.

Independent review fixed stream transport errors mislabeled as protocol errors; focused security review confirmed origin/document isolation and credential confinement in the relay.

The relay is implemented, not a future-plan-only transport. Ordinary worker idleness restores current-document session grants; lost live work is not replayed. A receiving site can still transmit results, and scripts on an approved origin share that origin's privileges.

GitHub releases distribute actual tgz artifacts; no public npm registry publication is claimed. Release download/install checks are separate from these source-checkout observations. LM Studio was not running. See README, testing.md and Actions for supported setup and current release/CI status.
