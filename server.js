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
    const comment = { id: generateId(), name, text, date: formatDate(new Date()), replies: [] };
    entry.comments.push(comment);
    writeData(data);
    return jsonResponse(res, 200, comment);
  }

  /* POST /api/reply — body: { page, parentId, name, text } */
  if (route === '/api/reply' && method === 'POST') {
    const body     = await readBody(req);
    const pageId   = (body.page || '').trim();
    const parentId = (body.parentId || '').trim();
    const name     = (body.name || '').trim().slice(0, 80);
    const text     = (body.text || '').trim().slice(0, 800);
    if (!pageId || !parentId || !name || !text) return jsonResponse(res, 400, { error: 'Missing fields' });
    const data   = readData();
    const entry  = getPage(data, pageId);
    const parent = entry.comments.find(c => c.id === parentId);
    if (!parent) return jsonResponse(res, 404, { error: 'Comment not found' });
    if (!parent.replies) parent.replies = [];
    const reply = { id: generateId(), name, text, date: formatDate(new Date()) };
    parent.replies.push(reply);
    writeData(data);
    return jsonResponse(res, 200, reply);
  }

  /* DELETE /api/comment — body: { page, id, parentId? } */
  if (route === '/api/comment' && method === 'DELETE') {
    const body     = await readBody(req);
    const pageId   = (body.page || '').trim();
    const id       = (body.id || '').trim();
    const parentId = (body.parentId || '').trim();
    if (!pageId || !id) return jsonResponse(res, 400, { error: 'Missing fields' });
    const data  = readData();
    const entry = getPage(data, pageId);
    if (parentId) {
      /* Delete a reply */
      const parent = entry.comments.find(c => c.id === parentId);
      if (parent && parent.replies) {
        const before = parent.replies.length;
        parent.replies = parent.replies.filter(r => r.id !== id);
        if (parent.replies.length < before) writeData(data);
      }
    } else {
      /* Delete a top-level comment */
      const before = entry.comments.length;
      entry.comments = entry.comments.filter(c => c.id !== id);
      if (entry.comments.length < before) writeData(data);
    }
    return jsonResponse(res, 200, { ok: true });
  }

  /* POST /api/community-post — body: { name, title, category, intro, content } */
  if (route === '/api/community-post' && method === 'POST') {
    const body     = await readBody(req);
    const name     = (body.name || '').trim().slice(0, 80);
    const title    = (body.title || '').trim().slice(0, 120);
    const category = (body.category || 'Communauté').trim().slice(0, 40);
    const intro    = (body.intro || '').trim().slice(0, 300);
    const content  = (body.content || '').trim().slice(0, 8000);
    if (!name || !title || !content) return jsonResponse(res, 400, { error: 'Missing fields' });

    const now   = new Date();
    const slug  = title.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 60) +
      '-' + Date.now().toString(36);
    const dateStr = formatDate(now);
    const dateShort = `${now.getDate()} ${['jan.','fév.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'][now.getMonth()]} ${now.getFullYear()}`;

    const safeText = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const nl2p = (s) => s.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
      .map(p => '<p>' + safeText(p).replace(/\n/g, '<br>') + '</p>').join('\n\n  ');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="description" content="${safeText(intro || title)}"/>
  <meta name="lumenia:title"    content="${safeText(title)}"/>
  <meta name="lumenia:category" content="${safeText(category)}"/>
  <meta name="lumenia:date"     content="${dateShort}"/>
  <meta name="lumenia:icon"     content="💬"/>
  <title>${safeText(title)} - Communauté Lumenia</title>
  <link rel="icon" type="image/svg+xml" href="/attached_assets/lumenia-icon.svg"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="/css/lumenia.css"/>
</head>
<body>

<header class="site-header">
  <a class="logo" href="/"><img src="/attached_assets/lumenia-icon.svg" alt=""/><span class="logo-text">Lumenia</span></a>
  <nav class="site-nav">
    <a href="/articles">Articles</a>
    <a href="/formations">Formations</a>
    <a href="/videos">Vidéos</a>
    <a href="/communaute">Communauté</a>
    <a href="/a-propos">À propos</a>
    <a href="/contact">Contact</a>
  </nav>
  <button class="hamburger" id="hamburger" aria-label="Menu" aria-expanded="false">
    <span></span><span></span><span></span>
  </button>
</header>

<div class="mobile-menu" id="mobile-menu">
  <a href="/">Accueil</a>
  <a href="/articles">Articles</a>
  <a href="/formations">Formations</a>
  <a href="/videos">Vidéos</a>
  <a href="/communaute">Communauté</a>
  <a href="/a-propos">À propos</a>
  <a href="/contact">Contact</a>
  <a href="/contact" class="m-cta">Newsletter</a>
</div>

<div class="article-header">
  <div class="article-meta">
    <span class="tag">${safeText(category)}</span>
    <span class="article-date">${dateShort}</span>
    <span class="article-read">· Publié par ${safeText(name)}</span>
  </div>
  <h1>${safeText(title)}</h1>
  ${intro ? `<p class="article-intro">${safeText(intro)}</p>` : ''}
</div>

<div class="article-body post-body">
  <a class="back-link" href="/communaute">← Retour à la communauté</a>

  ${nl2p(content)}

  <div class="article-footer">
    <a class="back-link" href="/communaute">← Voir toutes les publications</a>
  </div>
</div>

<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-brand">
      <a class="logo" href="/"><img src="/attached_assets/lumenia-icon.svg" alt=""/><span class="logo-text">Lumenia</span></a>
      <p>Votre source quotidienne de lumière, de savoir et d'inspiration.</p>
    </div>
    <div class="footer-links">
      <h4>Contenu</h4>
      <a href="/articles">Articles</a>
      <a href="/formations">Formations</a>
      <a href="/videos">Vidéos</a>
      <a href="/communaute">Communauté</a>
    </div>
  </div>
  <div class="footer-bottom">&copy; 2026 Lumenia &mdash; Savoir &amp; Inspiration</div>
</footer>

<nav class="bottom-nav" aria-label="Navigation principale">
  <a href="/"><span class="bn-icon"><svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg></span>Accueil</a>
  <a href="/articles"><span class="bn-icon"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg></span>Articles</a>
  <a href="/formations"><span class="bn-icon"><svg viewBox="0 0 24 24"><path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/></svg></span>Formations</a>
  <a href="/videos"><span class="bn-icon"><svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg></span>Vidéos</a>
  <a href="/communaute"><span class="bn-icon"><svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg></span>Communauté</a>
</nav>

<button class="back-to-top" id="back-to-top" aria-label="Retour en haut">
  <svg viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
</button>

<script src="/js/lumenia.js"></script>
<script src="/js/interactions.js"></script>
</body>
</html>`;

    const filePath = require('path').join(ROOT, 'communaute', slug + '.html');
    require('fs').writeFileSync(filePath, html, 'utf8');

    /* Rebuild index */
    try { require('child_process').execSync('node lumenia-build.js', { cwd: ROOT }); } catch (_) {}

    return jsonResponse(res, 200, { ok: true, slug, url: '/communaute/' + slug });
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
