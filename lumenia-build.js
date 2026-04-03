/**
 * Lumenia Build — Générateur automatique de data.json
 *
 * Utilisation : node lumenia-build.js
 *
 * Ce script scanne les dossiers de contenu, lit les métadonnées
 * de chaque fichier HTML et génère un data.json par section.
 *
 * Convention dans chaque fichier HTML :
 *   <meta name="lumenia:title"    content="Mon titre"/>
 *   <meta name="lumenia:category" content="Ma catégorie"/>
 *   <meta name="lumenia:date"     content="30 mars 2026"/>
 *   <meta name="lumenia:icon"     content="📝"/>
 */

const fs   = require('fs');
const path = require('path');

const SECTIONS = [
  { folder: 'articles',   label: 'Article',   icon: '📝' },
  { folder: 'formations', label: 'Formation', icon: '🎓' },
  { folder: 'videos',     label: 'Vidéo',     icon: '🎬' },
  { folder: 'communaute', label: 'Post',       icon: '💬' },
];

const SKIP_FILES = [
  'index.html',
  'modele-article.html',
  'modele-formation.html',
  'modele-video.html',
  'modele-post.html',
  'articles.js',
];

function extractMeta(html, name) {
  // Match name first, then content (handles apostrophes by using closing delimiter based on opening)
  const patterns = [
    new RegExp(`<meta[^>]+name=["']lumenia:${name}["'][^>]+content="([^"]*)"[^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']lumenia:${name}["'][^>]+content='([^']*)'[^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content="([^"]*)"[^>]+name=["']lumenia:${name}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content='([^']*)'[^>]+name=["']lumenia:${name}["'][^>]*>`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

function extractDescription(html) {
  // 1. Try lumenia:description meta
  const lumeniaDesc = extractMeta(html, 'description');
  if (lumeniaDesc) return lumeniaDesc;
  // 2. Try standard meta description
  const stdPatterns = [
    /<meta[^>]+name=["']description["'][^>]+content="([^"]+)"[^>]*>/i,
    /<meta[^>]+content="([^"]+)"[^>]+name=["']description["'][^>]*>/i,
  ];
  for (const re of stdPatterns) {
    const m = html.match(re);
    if (m && m[1].trim().length > 10) return m[1].trim();
  }
  // 3. Extract first paragraph text from article body
  const bodyMatch = html.match(/<(?:div[^>]+class=["'][^"']*article[^"']*["']|p)[^>]*>\s*<\/?(p|div)?>?((?:<(?!\/?(script|style|h[1-6]))[^>]*>)*)?([^<]{30,})/i);
  if (bodyMatch) {
    const text = bodyMatch[0].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return text.length > 140 ? text.slice(0, 137) + '…' : text;
  }
  return '';
}

function extractTitle(html) {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  if (!m) return null;
  return m[1]
    .replace(/\s*[-|–|—]\s*Lumenia\s*$/i, '')
    .trim();
}

function buildSection(section) {
  const { folder, label, icon } = section;

  if (!fs.existsSync(folder)) {
    console.log(`⚠️  Dossier "${folder}" introuvable, ignoré.`);
    return;
  }

  const files = fs.readdirSync(folder)
    .filter(f => f.endsWith('.html') && !SKIP_FILES.includes(f))
    .sort()
    .reverse();

  const items = files.map(file => {
    const html     = fs.readFileSync(path.join(folder, file), 'utf8');
    const title       = extractMeta(html, 'title')    || extractTitle(html) || file.replace(/\.html$/, '').replace(/-/g, ' ');
    const category    = extractMeta(html, 'category') || label;
    const date        = extractMeta(html, 'date')     || '';
    const icon_       = extractMeta(html, 'icon')     || icon;
    const description = extractDescription(html);
    const url         = `/${folder}/${file}`;
    return { title, category, date, icon: icon_, description, url };
  });

  const out = path.join(folder, 'data.json');
  fs.writeFileSync(out, JSON.stringify(items, null, 2), 'utf8');

  if (items.length === 0) {
    console.log(`📂 ${folder}/data.json — aucun contenu`);
  } else {
    console.log(`✅ ${folder}/data.json — ${items.length} fichier(s) :`);
    items.forEach(it => console.log(`   • ${it.title}`));
  }
}

console.log('🔨 Lumenia Build — Scan automatique des contenus...\n');
SECTIONS.forEach(buildSection);
console.log('\n✨ Terminé ! Les index se mettent à jour automatiquement.\n');
