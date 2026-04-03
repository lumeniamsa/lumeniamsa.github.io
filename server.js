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

/* ══════════════════════════════════════════
   COMMUNAUTÉ — stockage serveur (JSON)
   ══════════════════════════════════════════ */
const POSTS_FILE = path.join(ROOT, 'communaute', 'posts.json');

function loadPosts() {
  try {
    if (fs.existsSync(POSTS_FILE)) {
      return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
    }
  } catch (_) {}
  return [];
}

function savePosts(posts) {
  try {
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), 'utf8');
  } catch (e) {
    console.error('[community] Erreur sauvegarde :', e.message);
  }
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function handleCommunityAPI(req, res) {
  const method = req.method.toUpperCase();
  const url = req.url;

  /* GET /api/community/posts */
  if (method === 'GET' && url === '/api/community/posts') {
    return json(res, 200, loadPosts());
  }

  /* POST /api/community/posts */
  if (method === 'POST' && url === '/api/community/posts') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); if (body.length > 8000) req.destroy(); });
    req.on('end', () => {
      try {
        const post = JSON.parse(body);
        if (!post.id || !post.author || !post.title || !post.body) {
          return json(res, 400, { error: 'Champs manquants' });
        }
        const posts = loadPosts();
        posts.unshift({
          id:       String(post.id).slice(0, 32),
          author:   String(post.author).slice(0, 60),
          title:    String(post.title).slice(0, 120),
          body:     String(post.body).slice(0, 1200),
          category: String(post.category || 'Général').slice(0, 60),
          ts:       Date.now(),
          likes:    0,
        });
        savePosts(posts);
        return json(res, 201, posts[0]);
      } catch (e) {
        return json(res, 400, { error: 'JSON invalide' });
      }
    });
    return;
  }

  /* DELETE /api/community/posts/:id */
  const delMatch = url.match(/^\/api\/community\/posts\/([a-z0-9]+)$/i);
  if (method === 'DELETE' && delMatch) {
    const id = delMatch[1];
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      let ownerToken = '';
      try { ownerToken = JSON.parse(body).ownerToken || ''; } catch(_) {}
      const posts = loadPosts();
      const idx = posts.findIndex(p => p.id === id);
      if (idx === -1) return json(res, 404, { error: 'Post introuvable' });
      if (posts[idx].ownerToken && posts[idx].ownerToken !== ownerToken) {
        return json(res, 403, { error: 'Non autorisé' });
      }
      posts.splice(idx, 1);
      savePosts(posts);
      return json(res, 200, { ok: true });
    });
    return;
  }

  return json(res, 404, { error: 'Route inconnue' });
}

/* ══════════════════════════════════════════
   AUTO-BUILD (file watcher)
   ══════════════════════════════════════════ */
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
  }, 500);
}

function getContentFiles(folder) {
  const folderPath = path.join(ROOT, folder);
  if (!fs.existsSync(folderPath)) return {};
  const snapshot = {};
  fs.readdirSync(folderPath).forEach(f => {
    if (!f.endsWith('.html') || SKIP_FILES.includes(f)) return;
    try {
      snapshot[f] = fs.statSync(path.join(folderPath, f)).mtimeMs;
    } catch (_) {}
  });
  return snapshot;
}

const snapshots = {};
WATCH_FOLDERS.forEach(folder => {
  snapshots[folder] = getContentFiles(folder);
  console.log(`[watch] Surveillance active : ${folder}/`);
});

setInterval(() => {
  WATCH_FOLDERS.forEach(folder => {
    const current  = getContentFiles(folder);
    const previous = snapshots[folder];
    const changed  = Object.keys(current).some(f => current[f] !== previous[f])
                  || Object.keys(previous).some(f => !(f in current));
    if (changed) {
      console.log(`[auto-build] Changement détecté dans ${folder}/`);
      snapshots[folder] = current;
      rebuild();
    }
  });
}, 2000);

rebuild();

/* ══════════════════════════════════════════
   SERVEUR HTTP
   ══════════════════════════════════════════ */
const server = http.createServer((req, res) => {
  /* OPTIONS preflight (CORS) */
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  /* API communauté */
  if (req.url.startsWith('/api/community/')) {
    return handleCommunityAPI(req, res);
  }

  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  let filePath = path.join(ROOT, urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
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
          return res.end();
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
