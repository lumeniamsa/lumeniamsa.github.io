const http = require('http');
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 5000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8',
  '.xml':  'application/xml',
};

const WATCH_FOLDERS = ['articles', 'formations', 'videos', 'communaute'];
const SKIP_FILES = [
  'index.html', '_data.json', 'articles.js',
  'modele-article.html', 'modele-formation.html',
  'modele-video.html', 'modele-post.html',
];

let rebuildTimer = null;

function rebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    try {
      execSync('node lumenia-build.js', { cwd: ROOT });
      console.log('[auto-build] Index mis à jour');
    } catch (e) {
      console.error('[auto-build] Erreur :', e.message);
    }
  }, 300);
}

WATCH_FOLDERS.forEach(folder => {
  const folderPath = path.join(ROOT, folder);
  if (!fs.existsSync(folderPath)) return;

  fs.watch(folderPath, (event, filename) => {
    if (!filename) return;
    if (!filename.endsWith('.html')) return;
    if (SKIP_FILES.includes(filename)) return;
    console.log(`[auto-build] Changement détecté : ${folder}/${filename}`);
    rebuild();
  });

  console.log(`[watch] Surveillance active : ${folder}/`);
});

rebuild();

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  let filePath = path.join(ROOT, urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!path.extname(filePath)) {
    const withHtml = filePath + '.html';
    if (fs.existsSync(withHtml)) {
      filePath = withHtml;
    } else {
      const indexHtml = path.join(filePath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        if (!urlPath.endsWith('/')) {
          res.writeHead(301, { 'Location': urlPath + '/' });
          res.end();
          return;
        }
        filePath = indexHtml;
      }
    }
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      const notFound = path.join(ROOT, '404.html');
      fs.readFile(notFound, (e2, d2) => {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(e2 ? 'Not Found' : d2);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Lumenia server running at http://0.0.0.0:${PORT}`);
});
