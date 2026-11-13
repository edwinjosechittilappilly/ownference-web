import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
test('packaged command serves its own assets from an unrelated working directory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ownmode-web-'));
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const packageDir = join(dir, 'package');
  let child;
  try {
    for (const entry of [...pkg.files, 'package.json']) await cp(join(root, entry), join(packageDir, entry), { recursive: true });
    const reservation = createServer();
    await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    child = spawn(process.execPath, [join(packageDir, pkg.bin['ownmode-web'])], { cwd: dir, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
      child.stdout.once('data', resolve);
      child.once('error', reject);
      child.once('exit', code => reject(new Error(`Demo exited before listening: ${code}`)));
    });
    for (const path of ['/', '/app.js', '/sdk.js', '/style.css', '/logo.svg', '/hero.svg']) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      assert.equal(response.status, 200, path);
      assert.ok((await response.arrayBuffer()).byteLength, path);
    }
    assert.equal((await fetch(`http://127.0.0.1:${port}/package.json`)).status, 404);
  } finally {
    if (child && child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('exit', resolve)); }
    await rm(dir, { recursive: true, force: true });
  }
});
