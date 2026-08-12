// tools/serve.mjs — tiny static server so secure-context features (service worker, install)
// work locally. Run: npm run serve → http://127.0.0.1:4322/insight-hunter.html
// Pass --open (npm run launch / launch.cmd) to also open the default browser.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

createServer(async (req, res) => {
  const path = req.url === '/' ? '/insight-hunter.html' : decodeURIComponent(req.url.split('?')[0]);
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(4322, '127.0.0.1', () => {
  const url = 'http://127.0.0.1:4322/insight-hunter.html';
  console.log('serving at ' + url);
  if (process.argv.includes('--open')) {
    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    exec(cmd);
  }
});
