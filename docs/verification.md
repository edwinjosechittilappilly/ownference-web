# Observed verification

Environment: Node24.10.0 on arm64 Mac; real Chromium browser and real local Ownference/Ollama. Acceptance performed during implementation, 2026-11-12/13.

- `npm run check`: 10 behavior tests passed; ESLint, Secretlint and strict consumer/declaration typecheck passed. Loaded SDK coverage: 89.80% lines, 83.95% branches, 100% functions. UI JavaScript is not claimed as fully coverage-measured.
- Real `npm run smoke` with `OWNFERENCE_MODEL=ollama:llama3.2:latest`: SDK discovered the model and streamed a response through the authenticated local runtime.
- Actual UI at http://localhost:4173: token entry, connect, model selection and all five tasks (summarize/rewrite/extract/compare/draft) succeeded with real Ollama. Outputs retained facts from the supplied garden/product comparison text.
- Actual UI with `apple:system`: on-device summarization completed on this Mac.
- The page cleared the token input after connecting. Cancel produced “Request cancelled.”; Clear emptied source/output; Disconnect reported “Not connected” and left the token input empty.
- Download created ownference-result.txt (112 bytes in the observed Apple scenario). Copy confirmed “Copied to clipboard.” after awaiting the actual UI state.
- Responsive view at 390px wide had scrollWidth390px: no horizontal overflow. Desktop and mobile screenshots were visually inspected.
- Browser diagnostics included aborted request events during explicit cancellation/lifecycle cleanup; no claim of zero network diagnostic events is made.

Independent review fixed transport-read errors incorrectly labeled as protocol errors and added invalid-UTF8/connection-reset regression coverage. Focused re-review found no remaining code blockers.

The localhost workflow is verified. Arbitrary public HTTPS deployment/browser policy combinations are NOT universally verified. The extension/native browser relay is a plan only; current SDK transport is direct loopback HTTP. LM Studio was not running on this machine. No npm registry publication is claimed.

Development dependency audit was clean with the documented patched ESLint transitive dependency overrides. GitHub Actions status is separate from these local observations.
