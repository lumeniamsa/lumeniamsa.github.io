/* ═══════════════════════════════════════════════════════════════
   Lumenia — Interactions Firebase (Firestore temps réel)
   Likes · Commentaires · Réponses · Partage
   Compatible GitHub Pages — aucun backend requis
   ═══════════════════════════════════════════════════════════════ */

import { db } from './firebase-init.js';
import {
  doc, collection,
  getDoc, setDoc, updateDoc, addDoc, deleteDoc, getDocs,
  onSnapshot,
  query, orderBy,
  increment, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* ─────────────────────────────────────────────────────────────
   1. INITIALISATION — cible les pages article ou post communauté
   ───────────────────────────────────────────────────────────── */

const container = document.querySelector('.article-body') || document.querySelector('.post-body');
if (!container) throw new Error('[Lumenia] Aucun conteneur .article-body / .post-body trouvé.');

/* ── Identifiant de page Firestore ── */
function getPageKey() {
  let p = window.location.pathname
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\.html$/, '')
    .replace(/\//g, '__') || 'home';

  /* Pour /communaute/post.html?id=xxx, inclure l'id dans la clé */
  const params  = new URLSearchParams(window.location.search);
  const postId  = params.get('id');
  if (postId) p = p + '___' + postId;

  return p;
}

const PAGE_KEY  = getPageKey();
const LS_LIKED  = 'lumenia_liked_' + PAGE_KEY;

/* Refs Firestore */
const pageDocRef     = doc(db, 'interactions', PAGE_KEY);
const commentsColRef = collection(db, 'interactions', PAGE_KEY, 'comments');

/* Anti-spam : 40 secondes entre deux commentaires */
const SPAM_DELAY    = 40_000;
const LS_LAST_POST  = 'lumenia_last_comment_' + PAGE_KEY;

/* ─────────────────────────────────────────────────────────────
   2. BARRE DE PROGRESSION DE LECTURE
   ───────────────────────────────────────────────────────────── */

const progressBar = document.createElement('div');
progressBar.className = 'reading-progress';
document.body.insertBefore(progressBar, document.body.firstChild);

window.addEventListener('scroll', () => {
  const docH = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.width = (docH > 0 ? Math.min(100, (window.scrollY / docH) * 100) : 0) + '%';
}, { passive: true });

/* ─────────────────────────────────────────────────────────────
   3. INJECTION DU BLOC INTERACTIONS DANS LE DOM
   ───────────────────────────────────────────────────────────── */

const section = document.createElement('section');
section.className = 'interactions-section';
section.innerHTML = buildHTML();

const footer = container.querySelector('.article-footer');
if (footer) container.insertBefore(section, footer);
else container.appendChild(section);

/* ─────────────────────────────────────────────────────────────
   4. ABONNEMENTS FIRESTORE EN TEMPS RÉEL
   ───────────────────────────────────────────────────────────── */

/* ── 4a. Likes (snapshot sur le document de page) ── */
const unsubLikes = onSnapshot(pageDocRef, snap => {
  const data = snap.exists() ? snap.data() : {};
  updateLikeUI(data.likesCount || 0);
}, err => {
  console.warn('[Lumenia] Likes snapshot error:', err.message);
  updateLikeUI(0);
});

/* ── 4b. Commentaires (snapshot sur la sous-collection, triée) ── */
const commentsQuery = query(commentsColRef, orderBy('createdAt', 'asc'));

const unsubComments = onSnapshot(commentsQuery, async snap => {
  /* Récupérer les commentaires */
  const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  /* Pour chaque commentaire, charger ses réponses depuis Firestore */
  const withReplies = await Promise.all(comments.map(async c => {
    try {
      const repliesRef   = collection(db, 'interactions', PAGE_KEY, 'comments', c.id, 'replies');
      const repliesQuery = query(repliesRef, orderBy('createdAt', 'asc'));
      const repliesSnap  = await getDocs(repliesQuery);
      c.replies = repliesSnap.docs.map(r => ({ id: r.id, ...r.data() }));
    } catch (_) {
      c.replies = [];
    }
    return c;
  }));

  renderComments(withReplies);
}, err => {
  console.warn('[Lumenia] Comments snapshot error:', err.message);
  renderComments([]);
});

/* Nettoyage si la SPA navigue (non critique mais propre) */
window.addEventListener('beforeunload', () => {
  unsubLikes();
  unsubComments();
});

/* ─────────────────────────────────────────────────────────────
   5. UI LIKES
   ───────────────────────────────────────────────────────────── */

function updateLikeUI(count) {
  const btn = document.getElementById('like-btn');
  const cnt = document.getElementById('like-count');
  if (!btn || !cnt) return;
  const liked = localStorage.getItem(LS_LIKED) === '1';
  btn.classList.toggle('liked', liked);
  btn.setAttribute('aria-pressed', String(liked));
  btn.querySelector('.like-heart').textContent = liked ? '❤️' : '🤍';
  cnt.textContent = count;
}

/* ─────────────────────────────────────────────────────────────
   6. RENDU DES COMMENTAIRES
   ───────────────────────────────────────────────────────────── */

function renderComments(comments) {
  const list  = document.getElementById('comments-list');
  const count = document.getElementById('comments-count');
  if (!list) return;

  if (count) count.textContent = comments.length;

  if (!comments.length) {
    list.innerHTML = '<p class="no-comments">Soyez le premier à commenter !</p>';
    return;
  }

  list.innerHTML = comments.map(c => {
    const replies = (c.replies || []).map(r => commentReplyHTML(r, c.id)).join('');
    return `
      <div class="comment-item" data-id="${esc(c.id)}">
        <div class="comment-avatar">${initials(c.authorName)}</div>
        <div class="comment-content">
          <div class="comment-header">
            <span class="comment-name">${esc(c.authorName)}</span>
            <span class="comment-date">${formatTimestamp(c.createdAt)}</span>
            <button class="comment-delete" data-id="${esc(c.id)}" title="Supprimer" aria-label="Supprimer ce commentaire">✕</button>
          </div>
          <p class="comment-text">${esc(c.text).replace(/\n/g, '<br>')}</p>
          <button class="comment-reply-btn" data-id="${esc(c.id)}" data-name="${esc(c.authorName)}">↩ Répondre</button>
          ${replies ? `<div class="replies-list" data-parent="${esc(c.id)}">${replies}</div>` : `<div class="replies-list" data-parent="${esc(c.id)}"></div>`}
        </div>
      </div>`;
  }).join('');

  bindCommentActions(list);
}

function commentReplyHTML(r, parentId) {
  return `
    <div class="comment-item comment-reply" data-id="${esc(r.id)}">
      <div class="comment-avatar" style="width:34px;height:34px;font-size:.7rem">${initials(r.authorName)}</div>
      <div class="comment-content">
        <div class="comment-header">
          <span class="comment-name">${esc(r.authorName)}</span>
          <span class="comment-date">${formatTimestamp(r.createdAt)}</span>
          <button class="comment-delete" data-id="${esc(r.id)}" data-parent="${esc(parentId)}" title="Supprimer" aria-label="Supprimer">✕</button>
        </div>
        <p class="comment-text">${esc(r.text).replace(/\n/g, '<br>')}</p>
      </div>
    </div>`;
}

/* ─────────────────────────────────────────────────────────────
   7. ACTIONS SUR LES COMMENTAIRES (supprimer, répondre)
   ───────────────────────────────────────────────────────────── */

function bindCommentActions(list) {

  /* ── Supprimer un commentaire ou une réponse ── */
  list.querySelectorAll('.comment-delete').forEach(btn => {
    btn.addEventListener('click', async function () {
      const id       = this.dataset.id;
      const parentId = this.dataset.parent || null;
      if (!confirm('Supprimer ce message ?')) return;
      try {
        if (parentId) {
          await deleteDoc(doc(db, 'interactions', PAGE_KEY, 'comments', parentId, 'replies', id));
        } else {
          await deleteDoc(doc(db, 'interactions', PAGE_KEY, 'comments', id));
        }
        /* Le snapshot onSnapshot va automatiquement re-rendre */
      } catch (e) {
        console.error('[Lumenia] Delete error:', e);
        showToast('Impossible de supprimer. Réessayez.', true);
      }
    });
  });

  /* ── Ouvrir le formulaire de réponse ── */
  list.querySelectorAll('.comment-reply-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const parentId   = this.dataset.id;
      const parentName = this.dataset.name;

      /* Toggle : fermer si déjà ouvert */
      const existing = list.querySelector(`.reply-form[data-parent="${parentId}"]`);
      if (existing) { existing.remove(); return; }

      /* Fermer tous les autres formulaires ouverts */
      list.querySelectorAll('.reply-form').forEach(f => f.remove());

      const replyForm = document.createElement('div');
      replyForm.className = 'reply-form comment-form';
      replyForm.dataset.parent = parentId;
      replyForm.innerHTML = `
        <p class="form-title" style="font-size:.85rem;margin-bottom:8px;">
          ↩ Répondre à <strong>${esc(parentName)}</strong>
        </p>
        <div class="form-row">
          <label for="reply-name-${parentId}">Votre prénom *</label>
          <input type="text" id="reply-name-${parentId}" placeholder="Ex : Marc" maxlength="60" required/>
        </div>
        <div class="form-row">
          <label for="reply-text-${parentId}">Votre réponse *</label>
          <textarea id="reply-text-${parentId}" rows="3" placeholder="Votre réponse…" maxlength="600" required></textarea>
        </div>
        <div id="reply-error-${parentId}" style="display:none;color:#c0355a;font-size:.85rem;margin-bottom:6px;font-weight:600"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn-comment-submit btn-reply-submit" data-parent="${parentId}">Publier la réponse</button>
          <button type="button" class="btn-reply-cancel" style="background:none;border:1.5px solid var(--border);color:var(--muted);border-radius:10px;padding:10px 18px;font-weight:600;cursor:pointer;font-size:.9rem">Annuler</button>
        </div>`;

      /* Insérer après le contenu du commentaire parent */
      const commentItem = list.querySelector(`[data-id="${parentId}"]`);
      if (commentItem) commentItem.querySelector('.comment-content').appendChild(replyForm);

      replyForm.querySelector('.btn-reply-cancel').addEventListener('click', () => replyForm.remove());
      replyForm.querySelector('.btn-reply-submit').addEventListener('click', () => submitReply(parentId, replyForm));

      replyForm.querySelector(`#reply-name-${parentId}`).focus();
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   8. SOUMISSION D'UNE RÉPONSE
   ───────────────────────────────────────────────────────────── */

async function submitReply(parentId, replyForm) {
  const nameEl    = replyForm.querySelector(`#reply-name-${parentId}`);
  const textEl    = replyForm.querySelector(`#reply-text-${parentId}`);
  const errorEl   = replyForm.querySelector(`#reply-error-${parentId}`);
  const submitBtn = replyForm.querySelector('.btn-reply-submit');

  const name = (nameEl?.value || '').trim().slice(0, 60);
  const text = (textEl?.value || '').trim().slice(0, 600);

  /* Validation */
  if (!name || !text) {
    if (errorEl) { errorEl.textContent = 'Prénom et réponse requis.'; errorEl.style.display = 'block'; }
    return;
  }
  if (errorEl) errorEl.style.display = 'none';

  /* Anti-spam */
  const lastPost = parseInt(localStorage.getItem(LS_LAST_POST) || '0', 10);
  if (Date.now() - lastPost < SPAM_DELAY) {
    const wait = Math.ceil((SPAM_DELAY - (Date.now() - lastPost)) / 1000);
    if (errorEl) { errorEl.textContent = `Merci de patienter ${wait}s avant de reposter.`; errorEl.style.display = 'block'; }
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Publication…';

  try {
    const repliesRef = collection(db, 'interactions', PAGE_KEY, 'comments', parentId, 'replies');
    await addDoc(repliesRef, {
      authorName: name,
      text:       text,
      createdAt:  serverTimestamp()
    });

    localStorage.setItem(LS_LAST_POST, String(Date.now()));
    replyForm.remove();

    /* Recharger les réponses de CE commentaire (le onSnapshot ne couvre pas les sous-sous-collections) */
    await reloadReplies(parentId);

  } catch (e) {
    console.error('[Lumenia] Reply error:', e);
    if (errorEl) { errorEl.textContent = 'Erreur lors de la publication. Réessayez.'; errorEl.style.display = 'block'; }
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publier la réponse';
  }
}

/* Recharge les réponses d'un commentaire et met à jour le DOM */
async function reloadReplies(parentId) {
  try {
    const repliesRef   = collection(db, 'interactions', PAGE_KEY, 'comments', parentId, 'replies');
    const repliesQuery = query(repliesRef, orderBy('createdAt', 'asc'));
    const snap         = await getDocs(repliesQuery);
    const replies      = snap.docs.map(r => ({ id: r.id, ...r.data() }));

    const list = document.getElementById('comments-list');
    if (!list) return;
    const container = list.querySelector(`.replies-list[data-parent="${parentId}"]`);
    if (!container) return;

    container.innerHTML = replies.map(r => commentReplyHTML(r, parentId)).join('');

    /* Re-lier les boutons supprimer sur les nouvelles réponses */
    container.querySelectorAll('.comment-delete').forEach(btn => {
      btn.addEventListener('click', async function () {
        const id       = this.dataset.id;
        const parentId = this.dataset.parent;
        if (!confirm('Supprimer cette réponse ?')) return;
        try {
          await deleteDoc(doc(db, 'interactions', PAGE_KEY, 'comments', parentId, 'replies', id));
          await reloadReplies(parentId);
        } catch (e) {
          console.error('[Lumenia] Delete reply error:', e);
        }
      });
    });

    /* Scroll vers la dernière réponse */
    const last = container.lastElementChild;
    if (last) last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (e) {
    console.error('[Lumenia] reloadReplies error:', e);
  }
}

/* ─────────────────────────────────────────────────────────────
   9. ÉVÉNEMENTS GLOBAUX (like, partager)
   ───────────────────────────────────────────────────────────── */

document.addEventListener('click', async e => {

  /* ── Like / Unlike ── */
  if (e.target.closest('#like-btn')) {
    const likeBtn = document.getElementById('like-btn');
    if (likeBtn?.disabled) return;
    if (likeBtn) likeBtn.disabled = true;

    const liked  = localStorage.getItem(LS_LIKED) === '1';
    const delta  = liked ? -1 : 1;

    try {
      await setDoc(pageDocRef, { likesCount: increment(delta) }, { merge: true });
      localStorage.setItem(LS_LIKED, liked ? '0' : '1');
      if (!liked) animateLike();
      /* Le onSnapshot va mettre à jour le compteur automatiquement */
    } catch (e) {
      console.error('[Lumenia] Like error:', e);
      showToast('Erreur. Réessayez.', true);
    } finally {
      const btn = document.getElementById('like-btn');
      if (btn) btn.disabled = false;
    }
  }

  /* ── Partager ── */
  if (e.target.closest('#share-btn')) {
    const btn = document.getElementById('share-btn');
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: document.title, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        if (btn) { btn.textContent = '✅ Lien copié !'; setTimeout(() => { btn.textContent = '🔗 Partager'; }, 2200); }
      });
    } else {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); if (btn) { btn.textContent = '✅ Lien copié !'; setTimeout(() => { btn.textContent = '🔗 Partager'; }, 2200); } } catch (_) {}
      document.body.removeChild(ta);
    }
  }
});

/* ─────────────────────────────────────────────────────────────
   10. FORMULAIRE COMMENTAIRE PRINCIPAL
   ───────────────────────────────────────────────────────────── */

document.addEventListener('submit', async e => {
  if (!e.target.matches('#comment-form')) return;
  e.preventDefault();

  const nameEl   = document.getElementById('comment-name');
  const textEl   = document.getElementById('comment-text');
  const errorEl  = document.getElementById('comment-form-error');
  const submitEl = e.target.querySelector('.btn-comment-submit');

  const name = (nameEl?.value || '').trim().slice(0, 60);
  const text = (textEl?.value || '').trim().slice(0, 800);

  /* Validation */
  if (!name || !text) {
    showFormError(errorEl, 'Merci de remplir votre prénom et votre message.');
    return;
  }
  if (name.length < 2) {
    showFormError(errorEl, 'Votre prénom doit contenir au moins 2 caractères.');
    return;
  }
  if (text.length < 3) {
    showFormError(errorEl, 'Votre message est trop court (3 caractères min).');
    return;
  }

  /* Anti-spam */
  const lastPost = parseInt(localStorage.getItem(LS_LAST_POST) || '0', 10);
  if (Date.now() - lastPost < SPAM_DELAY) {
    const wait = Math.ceil((SPAM_DELAY - (Date.now() - lastPost)) / 1000);
    showFormError(errorEl, `Merci de patienter ${wait}s avant de commenter à nouveau.`);
    return;
  }

  if (errorEl) errorEl.style.display = 'none';
  if (submitEl) { submitEl.disabled = true; submitEl.textContent = 'Publication…'; }

  try {
    await addDoc(commentsColRef, {
      authorName: name,
      text:       text,
      createdAt:  serverTimestamp()
    });

    localStorage.setItem(LS_LAST_POST, String(Date.now()));

    if (nameEl) nameEl.value = '';
    if (textEl) textEl.value = '';

    /* Le onSnapshot va automatiquement mettre à jour la liste */
    showToast('Commentaire publié !', false);

  } catch (err) {
    console.error('[Lumenia] Comment error:', err);
    showFormError(errorEl, 'Erreur lors de la publication. Vérifiez votre connexion et réessayez.');
  } finally {
    if (submitEl) { submitEl.disabled = false; submitEl.textContent = 'Publier le commentaire'; }
  }
});

/* ─────────────────────────────────────────────────────────────
   11. ANIMATION & UTILITAIRES
   ───────────────────────────────────────────────────────────── */

function animateLike() {
  const btn = document.getElementById('like-btn');
  if (!btn) return;
  btn.classList.add('like-pop');
  setTimeout(() => btn.classList.remove('like-pop'), 350);
}

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
  const months = ['jan.','fév.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} à ${String(d.getHours()).padStart(2,'0')}h${String(d.getMinutes()).padStart(2,'0')}`;
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).map(w => (w[0] || '').toUpperCase()).slice(0, 2).join('');
}

function showFormError(el, msg) {
  if (!el) { console.warn('[Lumenia]', msg); return; }
  el.textContent = msg;
  el.style.display = 'block';
}

/* Toast de feedback non-bloquant */
function showToast(msg, isError = false) {
  const existing = document.querySelector('.lumenia-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'lumenia-toast';
  toast.textContent = msg;
  toast.style.cssText = [
    'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
    'padding:10px 22px', 'border-radius:50px', 'font-weight:600', 'font-size:.9rem',
    'z-index:9999', 'pointer-events:none', 'transition:opacity .3s',
    `background:${isError ? '#fff0f4' : '#f0fdf4'}`,
    `color:${isError ? '#c0355a' : '#166534'}`,
    `border:1.5px solid ${isError ? '#f9a8c0' : '#bbf7d0'}`
  ].join(';');
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2500);
}

/* ─────────────────────────────────────────────────────────────
   12. CONSTRUCTION HTML DU BLOC INTERACTIONS
   ───────────────────────────────────────────────────────────── */

function buildHTML() {
  return `
    <div class="interactions-inner">

      <div class="interactions-bar">
        <button id="like-btn" class="like-btn" aria-pressed="false" title="J'aime cet article">
          <span class="like-heart">🤍</span>
          <span class="like-label">J'aime</span>
          <span class="like-count-wrap">(<span id="like-count">…</span>)</span>
        </button>
        <button id="share-btn" class="share-btn">🔗 Partager</button>
      </div>

      <div class="comments-block">
        <h3 class="comments-title">💬 Commentaires (<span id="comments-count">…</span>)</h3>
        <div id="comments-list" class="comments-list">
          <p class="no-comments" style="color:#adb5bd">Chargement…</p>
        </div>

        <form id="comment-form" class="comment-form" novalidate>
          <h4 class="form-title">Laisser un commentaire</h4>
          <div class="form-row">
            <label for="comment-name">Votre prénom *</label>
            <input type="text" id="comment-name" name="name" placeholder="Ex : Marie"
                   maxlength="60" autocomplete="given-name" required/>
          </div>
          <div class="form-row">
            <label for="comment-text">Votre message *</label>
            <textarea id="comment-text" name="text" rows="4"
                      placeholder="Partagez votre avis ou une réflexion…"
                      maxlength="800" required></textarea>
          </div>
          <div id="comment-form-error" style="display:none;color:#c0355a;font-size:.85rem;margin-bottom:8px;font-weight:600;padding:8px 12px;background:#fff0f4;border-radius:8px;border:1px solid #f9a8c0"></div>
          <button type="submit" class="btn-comment-submit">Publier le commentaire</button>
        </form>
      </div>

    </div>`;
}
