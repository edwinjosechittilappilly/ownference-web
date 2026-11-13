import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const files = new Map([
  ['/', ['public/index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['public/app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['public/style.css', 'text/css; charset=utf-8']],
  ['/sdk.js', ['src/index.js', 'text/javascript; charset=utf-8']],
  ['/logo.svg', ['docs/assets/logo.svg', 'image/svg+xml']],
  ['/hero.svg', ['docs/assets/hero.svg', 'image/svg+xml']]
]);
export function createServer() {
  return http.createServer(async (req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src http://127.0.0.1:3210 http://localhost:3210; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    // Match the raw request path: no decoding or filesystem path resolution.
    const path = (req.url || '').split('?', 1)[0];
    const file = files.get(path);
    if (!file) { res.writeHead(404).end('Not found'); return; }
    try {
      const data = await readFile(new URL(file[0], import.meta.url));
      res.writeHead(200, { 'Content-Type': file[1], 'Content-Length': data.length });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { res.writeHead(500).end('Unable to serve application'); }
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid port number.');
  createServer().listen(port, '127.0.0.1', () => console.log(`OwnMode Web: http://localhost:${port}`));
}
