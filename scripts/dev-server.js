import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = new URL('../public', import.meta.url);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

async function serveFile(res, url) {
  try {
    const file = new URL(url, publicDir);
    const fileInfo = await stat(file);
    if (fileInfo.isDirectory()) {
      return serveFile(res, `${url}/index.html`);
    }
    const body = await readFile(file);
    const type = mimeTypes[extname(fileURLToPath(file))] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(body);
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = createServer((req, res) => {
  const { url = '/' } = req;
  const normalized = url === '/' ? '/index.html' : url;
  serveFile(res, normalized);
});

const port = Number(process.env.PORT || 4173);
server.listen(port, () => {
  console.log(`Fabric Sizer dev server running at http://localhost:${port}`);
});
