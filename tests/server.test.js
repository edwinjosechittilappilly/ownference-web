import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../server.js';

test('serves only explicitly whitelisted assets with restrictive headers', async () => {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const request = (path, method = 'GET') => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method }, res => { let body = ''; res.setEncoding('utf8'); res.on('data', chunk => body += chunk); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body })); }); req.on('error', reject); req.end();
  });
  try {
    const page = await request('/'); assert.equal(page.status, 200); assert.match(page.headers['content-security-policy'], /default-src 'none'/); assert.equal(page.headers['x-content-type-options'], 'nosniff');
    for (const path of ['/package.json', '/LICENSE', '/src/index.js', '/../package.json', '/%2e%2e/package.json', '/%2fetc%2fpasswd', '//app.js', '/.git/config']) assert.equal((await request(path)).status, 404, path);
    assert.equal((await request('/app.js', 'POST')).status, 405);
    assert.equal((await request('/sdk.js', 'HEAD')).body, '');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
