import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const defaultFile = path.join(publicDir, 'index.html');
const port = process.env.PORT || 4173;
const host = process.env.HOST || '0.0.0.0';
const audioManifest = new Set(
  (() => {
    try {
      return fs
        .readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.mp3'))
        .map((entry) => entry.name);
    } catch (error) {
      console.warn('[dev-server] Unable to read audio manifest:', error.message);
      return [];
    }
  })()
);

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.mp3': 'audio/mpeg'
};

function sendError(res, message, status = 500) {
  res.writeHead(status, { 'Content-Type': 'text/plain' });
  res.end(message);
}

function resolveAsset(pathname) {
  const sanitized = pathname.replace(/^\//, '');
  const candidates = [
    path.join(publicDir, sanitized)
  ];

  if (pathname.endsWith('.mp3') && audioManifest.has(sanitized)) {
    candidates.push(path.join(root, sanitized));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

function serveStatic(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname;
  const filePath = resolveAsset(pathname);

  if (!filePath) {
    return sendError(res, 'Not found', 404);
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
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

server.on('error', (error) => {
  console.error('[dev-server] Failed to start server:', error);
});

server.listen(port, host, () => {
  console.log(`Dev server running at http://${host}:${port}`);
});
