/* ═══════════════════════════════════════════════════════════════
   Lumenia — Interactions (likes, commentaires, partage)
   Stockage : localStorage — pas de backend requis
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var articleBody = document.querySelector('.article-body');
  if (!articleBody) return;

  var articleId = encodeURIComponent(window.location.pathname);
  var LS_LIKED     = 'lumenia_liked_'    + articleId;
  var LS_LIKES     = 'lumenia_likes_'    + articleId;
  var LS_COMMENTS  = 'lumenia_comments_' + articleId;

  /* ── Initialise les compteurs si premier passage ── */
  if (!localStorage.getItem(LS_LIKES)) {
    var seed = Math.floor(Math.random() * 46) + 5; // 5-50 likes par défaut
    localStorage.setItem(LS_LIKES, String(seed));
  }

  /* ── Helpers localStorage ── */
  function getLikes()    { return parseInt(localStorage.getItem(LS_LIKES) || '0', 10); }
  function isLiked()     { return localStorage.getItem(LS_LIKED) === '1'; }
  function getComments() {
    try { return JSON.parse(localStorage.getItem(LS_COMMENTS) || '[]'); }
    catch (e) { return []; }
  }
  function saveComments(arr) { localStorage.setItem(LS_COMMENTS, JSON.stringify(arr)); }

  /* ── Barre de progression de lecture ── */
  var progressBar = document.createElement('div');
  progressBar.className = 'reading-progress';
  document.body.insertBefore(progressBar, document.body.firstChild);

  window.addEventListener('scroll', function () {
    var docH  = document.documentElement.scrollHeight - window.innerHeight;
    var pct   = docH > 0 ? Math.min(100, (window.scrollY / docH) * 100) : 0;
    progressBar.style.width = pct + '%';
  }, { passive: true });

  /* ── Bloc d'interactions ── */
  var section = document.createElement('section');
  section.className = 'interactions-section';
  section.innerHTML = buildInteractionsHTML();

  var footer = articleBody.querySelector('.article-footer');
  if (footer) {
    articleBody.insertBefore(section, footer);
  } else {
    articleBody.appendChild(section);
  }

  /* ── Mise à jour de l'UI des likes ── */
  function updateLikeUI() {
    var btn   = document.getElementById('like-btn');
    var count = document.getElementById('like-count');
    if (!btn || !count) return;
    var liked = isLiked();
    btn.classList.toggle('liked', liked);
    btn.setAttribute('aria-pressed', String(liked));
    btn.querySelector('.like-heart').textContent = liked ? '❤️' : '🤍';
    count.textContent = getLikes();
  }

  /* ── Rendu des commentaires ── */
  function renderComments() {
    var list = document.getElementById('comments-list');
    if (!list) return;
    var comments = getComments();
    if (!comments.length) {
      list.innerHTML = '<p class="no-comments">Soyez le premier à commenter !</p>';
      return;
    }
    list.innerHTML = comments.map(function (c, i) {
      return '<div class="comment-item">' +
        '<div class="comment-avatar">' + initials(c.name) + '</div>' +
        '<div class="comment-content">' +
          '<div class="comment-header">' +
            '<span class="comment-name">' + esc(c.name) + '</span>' +
            '<span class="comment-date">' + esc(c.date) + '</span>' +
            '<button class="comment-delete" data-index="' + i + '" title="Supprimer" aria-label="Supprimer ce commentaire">✕</button>' +
          '</div>' +
          '<p class="comment-text">' + esc(c.text) + '</p>' +
        '</div>' +
      '</div>';
    }).join('');

    list.querySelectorAll('.comment-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.dataset.index, 10);
        var arr = getComments();
        arr.splice(idx, 1);
        saveComments(arr);
        renderComments();
        updateCommentCount();
      });
    });
  }

  function updateCommentCount() {
    var el = document.getElementById('comments-count');
    if (el) el.textContent = getComments().length;
  }

  /* ── Événements ── */
  document.addEventListener('click', function (e) {
    /* Like */
    if (e.target.closest('#like-btn')) {
      var liked = isLiked();
      var count = getLikes();
      if (liked) {
        localStorage.setItem(LS_LIKED, '0');
        localStorage.setItem(LS_LIKES, String(Math.max(0, count - 1)));
      } else {
        localStorage.setItem(LS_LIKED, '1');
        localStorage.setItem(LS_LIKES, String(count + 1));
        animateLike();
      }
      updateLikeUI();
    }

    /* Partager */
    if (e.target.closest('#share-btn')) {
      if (navigator.share) {
        navigator.share({
          title: document.title,
          url: window.location.href
        }).catch(function () {});
      } else {
        navigator.clipboard.writeText(window.location.href).then(function () {
          var btn = document.getElementById('share-btn');
          if (btn) {
            btn.textContent = '✅ Lien copié !';
            setTimeout(function () { btn.textContent = '🔗 Partager'; }, 2200);
          }
        }).catch(function () {});
      }
    }
  });

  /* Soumission du formulaire */
  document.addEventListener('submit', function (e) {
    if (!e.target.matches('#comment-form')) return;
    e.preventDefault();
    var nameEl = document.getElementById('comment-name');
    var textEl = document.getElementById('comment-text');
    var name = (nameEl ? nameEl.value : '').trim();
    var text = (textEl ? textEl.value : '').trim();
    if (!name || !text) return;
    var arr = getComments();
    arr.push({ name: name, text: text, date: formatDate(new Date()) });
    saveComments(arr);
    nameEl.value = '';
    textEl.value = '';
    renderComments();
    updateCommentCount();
    var list = document.getElementById('comments-list');
    if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ── Init ── */
  updateLikeUI();
  renderComments();
  updateCommentCount();

  /* ── Animation cœur ── */
  function animateLike() {
    var btn = document.getElementById('like-btn');
    if (!btn) return;
    btn.classList.add('like-pop');
    setTimeout(function () { btn.classList.remove('like-pop'); }, 350);
  }

  /* ── Utilitaires ── */
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function initials(name) {
    return (name || '?').trim().split(/\s+/).map(function (w) {
      return w[0].toUpperCase();
    }).slice(0, 2).join('');
  }

  function formatDate(d) {
    var months = ['jan.','fév.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  /* ── Construction HTML ── */
  function buildInteractionsHTML() {
    return '<div class="interactions-inner">' +

      '<div class="interactions-bar">' +
        '<button id="like-btn" class="like-btn" aria-pressed="false" title="J\'aime cet article">' +
          '<span class="like-heart">🤍</span>' +
          '<span class="like-label">J\'aime</span>' +
          '<span class="like-count-wrap">(<span id="like-count">0</span>)</span>' +
        '</button>' +
        '<button id="share-btn" class="share-btn">🔗 Partager</button>' +
      '</div>' +

      '<div class="comments-block">' +
        '<h3 class="comments-title">💬 Commentaires (<span id="comments-count">0</span>)</h3>' +
        '<div id="comments-list" class="comments-list"></div>' +
        '<form id="comment-form" class="comment-form" novalidate>' +
          '<h4 class="form-title">Laisser un commentaire</h4>' +
          '<div class="form-row">' +
            '<label for="comment-name">Votre prénom *</label>' +
            '<input type="text" id="comment-name" name="name" placeholder="Ex : Marie" maxlength="60" required/>' +
          '</div>' +
          '<div class="form-row">' +
            '<label for="comment-text">Votre message *</label>' +
            '<textarea id="comment-text" name="text" rows="4" placeholder="Partagez votre avis ou une réflexion…" maxlength="800" required></textarea>' +
          '</div>' +
          '<button type="submit" class="btn-comment-submit">Publier le commentaire</button>' +
        '</form>' +
      '</div>' +

    '</div>';
  }

})();
