# Architecture and browser integration

`src/index.js` is the browser SDK, with its public interface in `src/index.d.ts`. `public/app.js` is a real cooperating frontend using that same SDK. `server.js` serves an exact asset allowlist on loopback with restrictive headers.

## Flow and seam

The browser sends authenticated requests directly to the visitor's local OwnMode runtime. Model discovery returns provider-prefixed IDs. Generation returns a cancellable async iterable of text deltas; the SDK requires a terminal NDJSON record, bounds records, handles arbitrary UTF-8/chunk boundaries and distinguishes network failure, malformed protocol, cancellation and safe provider errors. Consumers use the same interface as tests.

This is not a server-side proxy. Localhost on your web backend means your server, not the visitor's computer. The page requests a token explicitly, keeps it only in memory and renders results as text. The demo uses epoch guards so obsolete async work cannot overwrite a disconnected or cleared workspace.

## Browser constraints

Hosted HTTPS-to-loopback access depends on browser Local Network Access/mixed-content/enterprise policy. Grant exact origins, never wildcard CORS, and never disable browser protections. Alternatively, `createRelayClient()` uses the OwnMode Browser extension: the user must choose Enable relay for this site in the extension before calling `await client.connect()`. Then `models()` and `generate()` use the same interfaces as the HTTP client; `disconnect()` stops outstanding work. Only top-level HTTP(S) documents are supported. The native host owns the runtime token; neither the page nor extension receives it. Connection attempts time out with instructions and must be retried explicitly after user approval.

The relay is an origin-level capability: any script running in the approved page's origin can request local model access, including malicious or compromised same-origin scripts. Approval is session-only and scoped by the extension to the tab and document. Relay access does not guarantee compatibility with every browser or enterprise policy.

## Privacy and adoption

There are no runtime dependencies, external CDN scripts, telemetry or cloud fallback. A consuming website still receives its results and can transmit them. Expose supported tasks and provider differences honestly. Keep tokens out of URLs, logs, source and automatic persistent storage. Install the SDK from a release tarball or local clone; do not advertise an npm publication that has not happened.
