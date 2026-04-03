/* ═══════════════════════════════════════════════════════════════
   Lumenia — Interactions partagées (API serveur)
   Likes, commentaires et partage — visibles par tous les visiteurs
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Cible : pages article OU publications communauté ── */
  var container = document.querySelector('.article-body') || document.querySelector('.post-body');
  if (!container) return;

  var PAGE_ID = window.location.pathname;
  var LS_LIKED = 'lumenia_liked_' + encodeURIComponent(PAGE_ID);

  /* ── Barre de progression de lecture ── */
  var progressBar = document.createElement('div');
  progressBar.className = 'reading-progress';
  document.body.insertBefore(progressBar, document.body.firstChild);

  window.addEventListener('scroll', function () {
    var docH = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.width = (docH > 0 ? Math.min(100, (window.scrollY / docH) * 100) : 0) + '%';
  }, { passive: true });

  /* ── Injection du bloc interactions ── */
  var section = document.createElement('section');
  section.className = 'interactions-section';
  section.innerHTML = buildHTML();

  var footer = container.querySelector('.article-footer');
  if (footer) container.insertBefore(section, footer);
  else container.appendChild(section);

  /* ── Chargement initial depuis le serveur ── */
  fetch('/api/interactions?page=' + encodeURIComponent(PAGE_ID))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      updateLikeUI(d.likes || 0);
      renderComments(d.comments || []);
    })
    .catch(function () {
      updateLikeUI(0);
      renderComments([]);
    });

  /* ── UI des likes ── */
  function updateLikeUI(count) {
    var btn   = document.getElementById('like-btn');
    var cnt   = document.getElementById('like-count');
    if (!btn || !cnt) return;
    var liked = localStorage.getItem(LS_LIKED) === '1';
    btn.classList.toggle('liked', liked);
    btn.setAttribute('aria-pressed', String(liked));
    btn.querySelector('.like-heart').textContent = liked ? '❤️' : '🤍';
    cnt.textContent = count;
  }

  /* ── Rendu des commentaires ── */
  function renderComments(comments) {
    var list  = document.getElementById('comments-list');
    var count = document.getElementById('comments-count');
    if (!list) return;
    if (count) count.textContent = comments.length;
    if (!comments.length) {
      list.innerHTML = '<p class="no-comments">Soyez le premier à commenter !</p>';
      return;
    }
    list.innerHTML = comments.map(function (c) {
      return '<div class="comment-item" data-id="' + esc(c.id) + '">' +
        '<div class="comment-avatar">' + initials(c.name) + '</div>' +
        '<div class="comment-content">' +
          '<div class="comment-header">' +
            '<span class="comment-name">' + esc(c.name) + '</span>' +
            '<span class="comment-date">' + esc(c.date) + '</span>' +
            '<button class="comment-delete" data-id="' + esc(c.id) + '" title="Supprimer" aria-label="Supprimer ce commentaire">✕</button>' +
          '</div>' +
          '<p class="comment-text">' + esc(c.text).replace(/\n/g, '<br>') + '</p>' +
        '</div>' +
      '</div>';
    }).join('');

    list.querySelectorAll('.comment-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = this.dataset.id;
        fetch('/api/comment', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page: PAGE_ID, id: id })
        }).then(function () {
          var item = list.querySelector('[data-id="' + id + '"]');
          if (item) { item.style.opacity = '0'; setTimeout(function () { item.remove(); refreshCount(); }, 200); }
        }).catch(console.error);
      });
    });
  }

  function refreshCount() {
    var list  = document.getElementById('comments-list');
    var count = document.getElementById('comments-count');
    if (count && list) count.textContent = list.querySelectorAll('.comment-item').length;
  }

  /* ── Événements ── */
  document.addEventListener('click', function (e) {

    /* Like / Unlike */
    if (e.target.closest('#like-btn')) {
      var liked  = localStorage.getItem(LS_LIKED) === '1';
      var action = liked ? 'unlike' : 'like';
      fetch('/api/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: PAGE_ID, action: action })
      })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        localStorage.setItem(LS_LIKED, liked ? '0' : '1');
        updateLikeUI(d.likes || 0);
        if (!liked) animateLike();
      })
      .catch(console.error);
    }

    /* Partager */
    if (e.target.closest('#share-btn')) {
      var btn = document.getElementById('share-btn');
      var url = window.location.href;
      if (navigator.share) {
        navigator.share({ title: document.title, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          if (btn) { btn.textContent = '✅ Lien copié !'; setTimeout(function () { btn.textContent = '🔗 Partager'; }, 2200); }
        });
      }
    }
  });

  /* Formulaire commentaire */
  document.addEventListener('submit', function (e) {
    if (!e.target.matches('#comment-form')) return;
    e.preventDefault();
    var nameEl   = document.getElementById('comment-name');
    var textEl   = document.getElementById('comment-text');
    var submitEl = e.target.querySelector('.btn-comment-submit');
    var name = (nameEl ? nameEl.value : '').trim();
    var text = (textEl ? textEl.value : '').trim();
    if (!name || !text) return;

    if (submitEl) { submitEl.disabled = true; submitEl.textContent = 'Publication…'; }

    fetch('/api/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: PAGE_ID, name: name, text: text })
    })
    .then(function (r) { return r.json(); })
    .then(function (comment) {
      if (nameEl) nameEl.value = '';
      if (textEl) textEl.value = '';
      /* Ajouter au DOM directement */
      var list = document.getElementById('comments-list');
      if (list) {
        var noComments = list.querySelector('.no-comments');
        if (noComments) noComments.remove();
        var div = document.createElement('div');
        div.className = 'comment-item';
        div.dataset.id = comment.id;
        div.innerHTML =
          '<div class="comment-avatar">' + initials(comment.name) + '</div>' +
          '<div class="comment-content">' +
            '<div class="comment-header">' +
              '<span class="comment-name">' + esc(comment.name) + '</span>' +
              '<span class="comment-date">' + esc(comment.date) + '</span>' +
              '<button class="comment-delete" data-id="' + esc(comment.id) + '" title="Supprimer" aria-label="Supprimer">✕</button>' +
            '</div>' +
            '<p class="comment-text">' + esc(comment.text).replace(/\n/g, '<br>') + '</p>' +
          '</div>';
        div.querySelector('.comment-delete').addEventListener('click', function () {
          var id = this.dataset.id;
          fetch('/api/comment', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ page: PAGE_ID, id: id })
          }).then(function () {
            div.style.opacity = '0';
            setTimeout(function () { div.remove(); refreshCount(); }, 200);
          });
        });
        list.appendChild(div);
        div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        refreshCount();
      }
    })
    .catch(function () { alert('Erreur lors de la publication. Veuillez réessayer.'); })
    .finally(function () {
      if (submitEl) { submitEl.disabled = false; submitEl.textContent = 'Publier le commentaire'; }
    });
  });

  /* ── Animation cœur ── */
  function animateLike() {
    var btn = document.getElementById('like-btn');
    if (!btn) return;
    btn.classList.add('like-pop');
    setTimeout(function () { btn.classList.remove('like-pop'); }, 350);
  }

  /* ── Utilitaires ── */
  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).map(function (w) {
      return (w[0] || '').toUpperCase();
    }).slice(0, 2).join('');
  }

  /* ── Construction HTML ── */
  function buildHTML() {
    return '<div class="interactions-inner">' +

      '<div class="interactions-bar">' +
        '<button id="like-btn" class="like-btn" aria-pressed="false" title="J\'aime cet article">' +
          '<span class="like-heart">🤍</span>' +
          '<span class="like-label">J\'aime</span>' +
          '<span class="like-count-wrap">(<span id="like-count">…</span>)</span>' +
        '</button>' +
        '<button id="share-btn" class="share-btn">🔗 Partager</button>' +
      '</div>' +

      '<div class="comments-block">' +
        '<h3 class="comments-title">💬 Commentaires (<span id="comments-count">…</span>)</h3>' +
        '<div id="comments-list" class="comments-list">' +
          '<p class="no-comments" style="color:#adb5bd">Chargement…</p>' +
        '</div>' +
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
