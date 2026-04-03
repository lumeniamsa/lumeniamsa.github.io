const http = require('http');
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 5000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'interactions.json');

/* ─────────────────────────────────────────────
   MIME TYPES
   ───────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────
   INTERACTIONS DATA (JSON file-based store)
   ───────────────────────────────────────────── */
function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (_) {
    return { interactions: {} };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getPage(data, pageId) {
  if (!data.interactions[pageId]) {
    data.interactions[pageId] = { likes: 0, comments: [] };
  }
  return data.interactions[pageId];
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(d) {
  const months = ['jan.','fév.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} à ${String(d.getHours()).padStart(2,'0')}h${String(d.getMinutes()).padStart(2,'0')}`;
}

/* ─────────────────────────────────────────────
   API HANDLER
   ───────────────────────────────────────────── */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 50000) reject(new Error('too large')); });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch (_) { resolve({}); }
    });
    req.on('error', reject);
  });
}

function jsonResponse(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

async function handleApi(req, res) {
  const urlObj  = new URL(req.url, 'http://localhost');
  const route   = urlObj.pathname;
  const method  = req.method.toUpperCase();

  /* GET /api/interactions?page=... */
  if (route === '/api/interactions' && method === 'GET') {
    const pageId = urlObj.searchParams.get('page') || '';
    if (!pageId) return jsonResponse(res, 400, { error: 'Missing page param' });
    const data  = readData();
    const entry = getPage(data, pageId);
    return jsonResponse(res, 200, { likes: entry.likes, comments: entry.comments });
  }

  /* POST /api/like — body: { page, action: "like"|"unlike" } */
  if (route === '/api/like' && method === 'POST') {
    const body   = await readBody(req);
    const pageId = (body.page || '').trim();
    const action = body.action === 'unlike' ? 'unlike' : 'like';
    if (!pageId) return jsonResponse(res, 400, { error: 'Missing page' });
    const data  = readData();
    const entry = getPage(data, pageId);
    if (action === 'like') {
      entry.likes = (entry.likes || 0) + 1;
    } else {
      entry.likes = Math.max(0, (entry.likes || 0) - 1);
    }
    writeData(data);
    return jsonResponse(res, 200, { likes: entry.likes });
  }

  /* POST /api/comment — body: { page, name, text } */
  if (route === '/api/comment' && method === 'POST') {
    const body   = await readBody(req);
    const pageId = (body.page || '').trim();
    const name   = (body.name || '').trim().slice(0, 80);
    const text   = (body.text || '').trim().slice(0, 1200);
    if (!pageId || !name || !text) return jsonResponse(res, 400, { error: 'Missing fields' });
    const data    = readData();
    const entry   = getPage(data, pageId);
    const comment = { id: generateId(), name, text, date: formatDate(new Date()) };
    entry.comments.push(comment);
    writeData(data);
    return jsonResponse(res, 200, comment);
  }

  /* DELETE /api/comment — body: { page, id } */
  if (route === '/api/comment' && method === 'DELETE') {
    const body   = await readBody(req);
    const pageId = (body.page || '').trim();
    const id     = (body.id || '').trim();
    if (!pageId || !id) return jsonResponse(res, 400, { error: 'Missing fields' });
    const data  = readData();
    const entry = getPage(data, pageId);
    const before = entry.comments.length;
    entry.comments = entry.comments.filter(c => c.id !== id);
    if (entry.comments.length < before) writeData(data);
    return jsonResponse(res, 200, { ok: true });
  }

  return jsonResponse(res, 404, { error: 'Not found' });
}

/* ─────────────────────────────────────────────
   AUTO-BUILD WATCHER
   ───────────────────────────────────────────── */
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
  }, 500);
}

function getContentFiles(folder) {
  const folderPath = path.join(ROOT, folder);
  if (!fs.existsSync(folderPath)) return {};
  const snapshot = {};
  fs.readdirSync(folderPath).forEach(f => {
    if (!f.endsWith('.html') || SKIP_FILES.includes(f)) return;
    try { snapshot[f] = fs.statSync(path.join(folderPath, f)).mtimeMs; } catch (_) {}
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

/* ─────────────────────────────────────────────
   HTTP SERVER
   ───────────────────────────────────────────── */
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  /* API routes */
  if (req.url.startsWith('/api/')) {
    try { await handleApi(req, res); } catch (e) {
      jsonResponse(res, 500, { error: 'Server error' });
    }
    return;
  }

  /* Static file serving */
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  let filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }

  if (!path.extname(filePath)) {
    const withHtml  = filePath + '.html';
    const indexHtml = path.join(filePath, 'index.html');
    if (fs.existsSync(withHtml)) {
      filePath = withHtml;
    } else if (fs.existsSync(indexHtml)) {
      if (!urlPath.endsWith('/')) {
        res.writeHead(301, { 'Location': urlPath + '/' });
        res.end();
        return;
      }
      filePath = indexHtml;
    }
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(ROOT, '404.html'), (e2, d2) => {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(e2 ? 'Not Found' : d2);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Lumenia server running at http://0.0.0.0:${PORT}`);
});
