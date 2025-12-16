import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const defaultFile = path.join(publicDir, 'index.html');
const port = process.env.PORT || 4173;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css'
};

function sendError(res, message, status = 500) {
  res.writeHead(status, { 'Content-Type': 'text/plain' });
  res.end(message);
}

function serveStatic(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname;
  const filePath = path.join(publicDir, pathname);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        return sendError(res, 'Not found', 404);
      }
      return sendError(res, 'Internal server error');
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/src/')) {
    const filePath = path.join(root, req.url.slice(1));
    fs.readFile(filePath, (err, data) => {
      if (err) {
        return sendError(res, 'Not found', 404);
      }
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(data);
    });
    return;
  }

  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Dev server running at http://localhost:${port}`);
});
