/**
 * serve.mjs — a static file server for `app/`, and nothing more.
 *
 * The app has no build step, so "run it" really is "serve the directory". This exists rather
 * than a dependency because the whole requirement is 40 lines and a dependency here would be
 * the only thing standing between a clone and a running map.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('../app', import.meta.url)));
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.geojson': 'application/geo+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
    try {
        const url = new URL(req.url || '/', 'http://localhost');
        let path = decodeURIComponent(url.pathname);
        if (path === '/') path = '/index.html';

        // Contain every request inside app/. Without this, `GET /../../.env` is served.
        const full = normalize(join(ROOT, path));
        if (!full.startsWith(ROOT)) {
            res.writeHead(403).end('Forbidden');
            return;
        }

        const body = await readFile(full);
        res.writeHead(200, {
            'Content-Type': TYPES[extname(full)] || 'application/octet-stream',
            'Cache-Control': 'no-store',
        }).end(body);
    } catch {
        res.writeHead(404).end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`serving app/ on http://localhost:${PORT}`);
});
