# Security

Do not commit tokens, sensitive prompts or model output. Tokens authorize an origin grant and belong only in user-controlled memory. The runtime enforces origin, token, and loopback restrictions; this SDK is not a substitute for those controls. Treat all source and generated text as untrusted and render as text. Local providers can still retain their own logs; review their configuration.

For a suspected vulnerability, avoid publishing exploit details in an issue. Contact the repository maintainers privately through the hosting platform's private vulnerability reporting feature when available. No public response SLA is promised.
