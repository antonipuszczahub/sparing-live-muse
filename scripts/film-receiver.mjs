// A tiny local receiver for the film tools (public/film): the voice studio sends each recorded line here, and the
// renderer sends the finished video. It accepts POST /save/<name> and writes public/film/incoming/<name>.
// Local only (127.0.0.1), plain node, no packages. Run: node scripts/film-receiver.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'film', 'incoming');
fs.mkdirSync(root, { recursive: true });
const port = Number(process.env.FILM_PORT ?? 9112);

http
  .createServer((req, res) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, GET, DELETE, OPTIONS' };
    if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
    const m = /^\/save\/([a-z0-9_.-]{1,60})$/i.exec(req.url ?? '');
    if (req.method === 'POST' && m) {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        fs.writeFileSync(path.join(root, m[1]), body);
        console.log('saved', m[1], body.length, 'bytes');
        res.writeHead(200, cors).end('ok');
      });
      return;
    }
    const del = /^\/save\/([a-z0-9_.-]{1,60})$/i.exec(req.url ?? '');
    if (req.method === 'DELETE' && del) {
      fs.rmSync(path.join(root, del[1]), { force: true });
      console.log('deleted', del[1]);
      return res.writeHead(200, cors).end('ok');
    }
    if (req.method === 'POST' && req.url === '/clear') {
      // only the narrator's and callers' voice takes, never the renders
      for (const f of fs.readdirSync(root)) if (/^[ac]\d{2}[a-z]?\.webm$/.test(f)) fs.rmSync(path.join(root, f), { force: true });
      console.log('cleared all voice takes');
      return res.writeHead(200, cors).end('ok');
    }
    if (req.url === '/list') return res.writeHead(200, cors).end(JSON.stringify(fs.readdirSync(root)));
    res.writeHead(200, cors).end('film receiver');
  })
  .listen(port, '127.0.0.1', () => console.log(`film receiver on http://127.0.0.1:${port}, writing to ${root}`));
