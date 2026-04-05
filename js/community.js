/* ═══════════════════════════════════════════════════════════════
   Lumenia — Community (Firestore)
   Listing + Création de publications communauté
   Compatible GitHub Pages — aucun backend requis
   ═══════════════════════════════════════════════════════════════ */

import { db } from './firebase-init.js';
import {
  collection, addDoc, onSnapshot,
  query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const postsColRef = collection(db, 'community_posts');
const postsQuery  = query(postsColRef, orderBy('createdAt', 'desc'));

/* Anti-spam : 60 s entre deux publications */
const SPAM_DELAY   = 60_000;
const LS_LAST_PUB  = 'lumenia_last_pub';

/* ─────────────────────────────────────────────────────────────
   1. ÉLÉMENTS DOM
   ───────────────────────────────────────────────────────────── */

const listingContainer = document.getElementById('listing-container');
const listingCount     = document.getElementById('listing-count');
const searchInput      = document.getElementById('search-input');
const filterBar        = document.getElementById('filter-bar');

const modal      = document.getElementById('create-post-modal');
const form       = document.getElementById('create-post-form');
const msgBox     = document.getElementById('create-post-msg');
const submitBtn  = document.getElementById('post-submit-btn');

/* ─────────────────────────────────────────────────────────────
   2. LISTING EN TEMPS RÉEL (onSnapshot)
   ───────────────────────────────────────────────────────────── */

let allPosts = [];

const unsubPosts = onSnapshot(postsQuery, snap => {
  allPosts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  buildFilters(allPosts);
  applyFilters();
}, err => {
  console.warn('[Lumenia] Posts snapshot error:', err.message);
  if (listingContainer) {
    listingContainer.innerHTML = buildEmpty('Impossible de charger les publications. Vérifiez votre connexion.');
  }
});

window.addEventListener('beforeunload', () => unsubPosts());

/* ─────────────────────────────────────────────────────────────
   3. FILTRES ET RECHERCHE
   ───────────────────────────────────────────────────────────── */

function buildFilters(posts) {
  if (!filterBar) return;
  const cats = ['Tous'];
  posts.forEach(p => {
    const c = p.category || 'Communauté';
    if (!cats.includes(c)) cats.push(c);
  });

  if (cats.length <= 2) { filterBar.style.display = 'none'; return; }
  filterBar.style.display = '';
  filterBar.innerHTML = cats.map(c =>
    `<button class="filter-chip${c === 'Tous' ? ' active' : ''}" data-cat="${escAttr(c)}">${esc(c)}</button>`
  ).join('');

  filterBar.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', function () {
      filterBar.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      applyFilters();
    });
  });
}

function applyFilters() {
  const q          = (searchInput?.value || '').toLowerCase().trim();
  const activeChip = filterBar?.querySelector('.filter-chip.active');
  const cat        = activeChip ? activeChip.dataset.cat : 'Tous';

  const filtered = allPosts.filter(p => {
    const matchCat = cat === 'Tous' || (p.category || 'Communauté') === cat;
    const matchQ   = !q
      || (p.title      || '').toLowerCase().includes(q)
      || (p.authorName || '').toLowerCase().includes(q)
      || (p.intro      || '').toLowerCase().includes(q)
      || (p.category   || '').toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  renderPosts(filtered);
}

if (searchInput) searchInput.addEventListener('input', applyFilters);

/* ─────────────────────────────────────────────────────────────
   4. RENDU DES PUBLICATIONS
   ───────────────────────────────────────────────────────────── */

function renderPosts(posts) {
  if (!listingContainer) return;

  if (listingCount) {
    listingCount.textContent = posts.length + ' publication' + (posts.length !== 1 ? 's' : '');
  }

  if (!posts.length) {
    listingContainer.innerHTML = buildEmpty(
      allPosts.length
        ? 'Aucune publication ne correspond à votre recherche.'
        : 'Soyez le premier à publier dans la communauté !'
    );
    return;
  }

  listingContainer.innerHTML = `<div class="cards-grid">${posts.map(buildCard).join('')}</div>`;
  listingContainer.querySelectorAll('.fade-in').forEach(el => {
    requestAnimationFrame(() => el.classList.add('visible'));
  });
}

function buildCard(post) {
  const url  = `/communaute/post.html?id=${encodeURIComponent(post.id)}`;
  const cat  = post.category  || 'Communauté';
  const date = formatTimestamp(post.createdAt);
  const desc = post.intro     || '';

  return `
    <a class="article-card fade-in" href="${escAttr(url)}">
      <div class="card-top">
        <span class="card-cat">${esc(cat)}</span>
        ${date ? `<span class="card-read-time">${esc(date)}</span>` : ''}
      </div>
      <span class="card-icon">💬</span>
      <h3 class="card-title">${esc(post.title || 'Sans titre')}</h3>
      ${desc ? `<p class="card-desc">${esc(desc)}</p>` : ''}
      <div class="card-footer">
        <span class="card-date">Par ${esc(post.authorName || 'Anonyme')}</span>
        <span class="card-arrow">→</span>
      </div>
    </a>`;
}

function buildEmpty(msg) {
  return `<div class="empty-state"><div class="empty-icon">💬</div><p>${esc(msg)}</p></div>`;
}

/* ─────────────────────────────────────────────────────────────
   5. MODALE — OUVERTURE / FERMETURE
   ───────────────────────────────────────────────────────────── */

function openModal()  {
  if (!modal) return;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('post-name')?.focus();
}

function closeModal() {
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('open-create-post')?.addEventListener('click',  openModal);
document.getElementById('open-create-post-2')?.addEventListener('click', openModal);
document.getElementById('close-modal')?.addEventListener('click',   closeModal);
document.getElementById('cancel-modal')?.addEventListener('click',  closeModal);
modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ─────────────────────────────────────────────────────────────
   6. CRÉATION D'UNE PUBLICATION (Firestore addDoc)
   ───────────────────────────────────────────────────────────── */

form?.addEventListener('submit', async e => {
  e.preventDefault();

  const name    = (document.getElementById('post-name')?.value    || '').trim().slice(0, 60);
  const title   = (document.getElementById('post-title')?.value   || '').trim().slice(0, 120);
  const cat     = (document.getElementById('post-category')?.value || 'Communauté').trim();
  const intro   = (document.getElementById('post-intro')?.value   || '').trim().slice(0, 300);
  const content = (document.getElementById('post-content')?.value || '').trim().slice(0, 8000);

  /* Validation */
  if (!name) { showMsg('Merci d\'indiquer votre prénom.', true); return; }
  if (name.length < 2) { showMsg('Prénom trop court (2 caractères min).', true); return; }
  if (!title) { showMsg('Merci d\'indiquer un titre.', true); return; }
  if (title.length < 5) { showMsg('Titre trop court (5 caractères min).', true); return; }
  if (!content) { showMsg('Le contenu ne peut pas être vide.', true); return; }
  if (content.length < 20) { showMsg('Contenu trop court (20 caractères min).', true); return; }

  /* Anti-spam */
  const lastPub = parseInt(localStorage.getItem(LS_LAST_PUB) || '0', 10);
  if (Date.now() - lastPub < SPAM_DELAY) {
    const wait = Math.ceil((SPAM_DELAY - (Date.now() - lastPub)) / 1000);
    showMsg(`Merci de patienter ${wait}s avant de publier à nouveau.`, true);
    return;
  }

  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Publication en cours…'; }
  if (msgBox) msgBox.style.display = 'none';

  try {
    const slug = slugify(title);
    const docRef = await addDoc(postsColRef, {
      title,
      authorName: name,
      category:   cat,
      intro,
      content,
      slug,
      createdAt: serverTimestamp()
    });

    localStorage.setItem(LS_LAST_PUB, String(Date.now()));
    showMsg('✅ Publication créée avec succès ! Redirection…', false);

    setTimeout(() => {
      closeModal();
      window.location.href = `/communaute/post.html?id=${encodeURIComponent(docRef.id)}`;
    }, 1200);

  } catch (err) {
    console.error('[Lumenia] Create post error:', err);
    showMsg('Erreur lors de la publication. Vérifiez votre connexion et réessayez.', true);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '📤 Publier'; }
  }
});

/* ─────────────────────────────────────────────────────────────
   7. UTILITAIRES
   ───────────────────────────────────────────────────────────── */

function showMsg(text, isError) {
  if (!msgBox) return;
  msgBox.textContent = text;
  msgBox.style.display = 'block';
  msgBox.style.background = isError ? '#fff0f4' : '#f0fdf4';
  msgBox.style.color      = isError ? '#c0355a' : '#166534';
  msgBox.style.border     = '1px solid ' + (isError ? '#f9a8c0' : '#bbf7d0');
}

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
  const months = ['jan.','fév.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').slice(0, 60);
}

function esc(s)     { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s) { return String(s || '').replace(/"/g,'&quot;'); }
