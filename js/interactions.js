/* ═══════════════════════════════════════════════════════════════
   Lumenia — Interactions partagées (API serveur)
   Likes, commentaires, réponses et partage — visibles par tous
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

  /* ── Lier les événements directement après injection ── */
  bindLikeButton();
  bindShareButton();
  bindCommentForm();

  /* ── Chargement initial depuis le serveur ── */
  fetch('/api/interactions?page=' + encodeURIComponent(PAGE_ID))
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (d) {
      updateLikeUI(d.likes || 0);
      renderComments(d.comments || []);
    })
    .catch(function () {
      updateLikeUI(0);
      renderComments([]);
    });

  /* ── Lier le bouton J'aime ── */
  function bindLikeButton() {
    var likeBtn = document.getElementById('like-btn');
    if (!likeBtn) return;
    likeBtn.addEventListener('click', function () {
      if (likeBtn.disabled) return;
      var liked  = localStorage.getItem(LS_LIKED) === '1';
      var action = liked ? 'unlike' : 'like';
      likeBtn.disabled = true;

      fetch('/api/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: PAGE_ID, action: action })
      })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        localStorage.setItem(LS_LIKED, liked ? '0' : '1');
        updateLikeUI(d.likes || 0);
        if (!liked) animateLike();
      })
      .catch(function (e) { console.error('Like error:', e); })
      .finally(function () { likeBtn.disabled = false; });
    });
  }

  /* ── Lier le bouton Partager ── */
  function bindShareButton() {
    var shareBtn = document.getElementById('share-btn');
    if (!shareBtn) return;
    shareBtn.addEventListener('click', function () {
      var url = window.location.href;
      if (navigator.share) {
        navigator.share({ title: document.title, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          shareBtn.textContent = '✅ Lien copié !';
          setTimeout(function () { shareBtn.textContent = '🔗 Partager'; }, 2200);
        });
      } else {
        var ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          shareBtn.textContent = '✅ Lien copié !';
          setTimeout(function () { shareBtn.textContent = '🔗 Partager'; }, 2200);
        } catch (_) {}
        document.body.removeChild(ta);
      }
    });
  }

  /* ── Lier le formulaire de commentaire principal ── */
  function bindCommentForm() {
    var form     = document.getElementById('comment-form');
    var submitEl = form ? form.querySelector('.btn-comment-submit') : null;
    if (!form) return;

    function handleCommentSubmit(e) {
      if (e && e.preventDefault) e.preventDefault();
      var nameEl = document.getElementById('comment-name');
      var textEl = document.getElementById('comment-text');
      var name   = (nameEl ? nameEl.value : '').trim();
      var text   = (textEl ? textEl.value : '').trim();
      if (!name || !text) return;

      if (submitEl) { submitEl.disabled = true; submitEl.textContent = 'Publication…'; }

      fetch('/api/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: PAGE_ID, name: name, text: text })
      })
      .then(function (r) {
        if (!r.ok) throw new Error('Erreur serveur (' + r.status + ')');
        return r.json();
      })
      .then(function (comment) {
        if (nameEl) nameEl.value = '';
        if (textEl) textEl.value = '';
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
              '<button class="comment-reply-btn" data-id="' + esc(comment.id) + '" data-name="' + esc(comment.name) + '">↩ Répondre</button>' +
            '</div>';
          list.appendChild(div);
          bindCommentActions(list);
          div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          refreshCount();
        }
      })
      .catch(function (err) {
        alert('Erreur lors de la publication. Veuillez réessayer.\n(' + (err.message || '') + ')');
      })
      .finally(function () {
        if (submitEl) { submitEl.disabled = false; submitEl.textContent = 'Publier le commentaire'; }
      });
    }

    /* Liaison sur le formulaire directement */
    form.addEventListener('submit', handleCommentSubmit);

    /* Liaison sur le bouton submit en cas de problème de déclenchement */
    if (submitEl) {
      submitEl.addEventListener('click', function (e) {
        e.preventDefault();
        handleCommentSubmit(e);
      });
    }
  }

  /* ── UI des likes ── */
  function updateLikeUI(count) {
    var btn  = document.getElementById('like-btn');
    var cnt  = document.getElementById('like-count');
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
      var replies = (c.replies || []).map(function (r) {
        return '<div class="comment-item comment-reply" data-id="' + esc(r.id) + '">' +
          '<div class="comment-avatar" style="width:34px;height:34px;font-size:.7rem">' + initials(r.name) + '</div>' +
          '<div class="comment-content">' +
            '<div class="comment-header">' +
              '<span class="comment-name">' + esc(r.name) + '</span>' +
              '<span class="comment-date">' + esc(r.date) + '</span>' +
              '<button class="comment-delete" data-id="' + esc(r.id) + '" data-parent="' + esc(c.id) + '" title="Supprimer" aria-label="Supprimer">✕</button>' +
            '</div>' +
            '<p class="comment-text">' + esc(r.text).replace(/\n/g, '<br>') + '</p>' +
          '</div>' +
        '</div>';
      }).join('');

      return '<div class="comment-item" data-id="' + esc(c.id) + '">' +
        '<div class="comment-avatar">' + initials(c.name) + '</div>' +
        '<div class="comment-content">' +
          '<div class="comment-header">' +
            '<span class="comment-name">' + esc(c.name) + '</span>' +
            '<span class="comment-date">' + esc(c.date) + '</span>' +
            '<button class="comment-delete" data-id="' + esc(c.id) + '" title="Supprimer" aria-label="Supprimer ce commentaire">✕</button>' +
          '</div>' +
          '<p class="comment-text">' + esc(c.text).replace(/\n/g, '<br>') + '</p>' +
          '<button class="comment-reply-btn" data-id="' + esc(c.id) + '" data-name="' + esc(c.name) + '">↩ Répondre</button>' +
          (replies ? '<div class="replies-list">' + replies + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    bindCommentActions(list);
  }

  /* ── Lier les actions de commentaires ── */
  function bindCommentActions(list) {
    /* Supprimer */
    list.querySelectorAll('.comment-delete').forEach(function (btn) {
      /* Éviter les doublons de listeners */
      if (btn._bound) return;
      btn._bound = true;
      btn.addEventListener('click', function () {
        var id     = this.dataset.id;
        var parent = this.dataset.parent || null;
        fetch('/api/comment', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page: PAGE_ID, id: id, parentId: parent })
        }).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          var item = list.querySelector('[data-id="' + id + '"]');
          if (item) {
            item.style.opacity = '0';
            setTimeout(function () { item.remove(); refreshCount(); }, 200);
          }
        }).catch(function (e) { console.error('Delete error:', e); });
      });
    });

    /* Répondre */
    list.querySelectorAll('.comment-reply-btn').forEach(function (btn) {
      if (btn._bound) return;
      btn._bound = true;
      btn.addEventListener('click', function () {
        var parentId   = this.dataset.id;
        var parentName = this.dataset.name;
        var existing   = list.querySelector('.reply-form[data-parent="' + parentId + '"]');
        if (existing) { existing.remove(); return; }

        list.querySelectorAll('.reply-form').forEach(function (f) { f.remove(); });

        var replyForm = document.createElement('div');
        replyForm.className = 'reply-form comment-form';
        replyForm.dataset.parent = parentId;
        replyForm.innerHTML =
          '<p class="form-title" style="font-size:.85rem;margin-bottom:8px;">↩ Répondre à <strong>' + esc(parentName) + '</strong></p>' +
          '<div class="form-row">' +
            '<label for="reply-name-' + parentId + '">Votre prénom *</label>' +
            '<input type="text" id="reply-name-' + parentId + '" placeholder="Ex : Marc" maxlength="60" required/>' +
          '</div>' +
          '<div class="form-row">' +
            '<label for="reply-text-' + parentId + '">Votre réponse *</label>' +
            '<textarea id="reply-text-' + parentId + '" rows="3" placeholder="Votre réponse…" maxlength="600" required></textarea>' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<button type="button" class="btn-comment-submit btn-reply-submit" data-parent="' + parentId + '">Publier la réponse</button>' +
            '<button type="button" class="btn-reply-cancel" style="background:none;border:1.5px solid var(--border);color:var(--muted);border-radius:10px;padding:10px 18px;font-weight:600;cursor:pointer;font-size:.9rem">Annuler</button>' +
          '</div>';

        var commentItem = list.querySelector('[data-id="' + parentId + '"]');
        if (commentItem) commentItem.querySelector('.comment-content').appendChild(replyForm);

        replyForm.querySelector('.btn-reply-cancel').addEventListener('click', function () { replyForm.remove(); });

        replyForm.querySelector('.btn-reply-submit').addEventListener('click', function () {
          var pid    = this.dataset.parent;
          var nameEl = document.getElementById('reply-name-' + pid);
          var textEl = document.getElementById('reply-text-' + pid);
          var name   = (nameEl ? nameEl.value : '').trim();
          var text   = (textEl ? textEl.value : '').trim();
          if (!name || !text) return;
          var submitBtn = this;
          submitBtn.disabled = true;
          submitBtn.textContent = 'Publication…';

          fetch('/api/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ page: PAGE_ID, parentId: pid, name: name, text: text })
          })
          .then(function (r) {
            if (!r.ok) throw new Error('Erreur serveur (' + r.status + ')');
            return r.json();
          })
          .then(function (reply) {
            var repliesList = commentItem.querySelector('.replies-list');
            if (!repliesList) {
              repliesList = document.createElement('div');
              repliesList.className = 'replies-list';
              commentItem.querySelector('.comment-content').insertBefore(repliesList, replyForm);
            }
            var div = document.createElement('div');
            div.className = 'comment-item comment-reply';
            div.dataset.id = reply.id;
            div.innerHTML =
              '<div class="comment-avatar" style="width:34px;height:34px;font-size:.7rem">' + initials(reply.name) + '</div>' +
              '<div class="comment-content">' +
                '<div class="comment-header">' +
                  '<span class="comment-name">' + esc(reply.name) + '</span>' +
                  '<span class="comment-date">' + esc(reply.date) + '</span>' +
                  '<button class="comment-delete" data-id="' + esc(reply.id) + '" data-parent="' + esc(pid) + '" title="Supprimer">✕</button>' +
                '</div>' +
                '<p class="comment-text">' + esc(reply.text).replace(/\n/g, '<br>') + '</p>' +
              '</div>';
            div.querySelector('.comment-delete').addEventListener('click', function () {
              fetch('/api/comment', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page: PAGE_ID, id: reply.id, parentId: pid })
              }).then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                div.style.opacity = '0';
                setTimeout(function () { div.remove(); }, 200);
              });
            });
            repliesList.appendChild(div);
            replyForm.remove();
          })
          .catch(function (e) {
            alert('Erreur lors de la publication de la réponse. Veuillez réessayer.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Publier la réponse';
          });
        });
      });
    });
  }

  function refreshCount() {
    var list  = document.getElementById('comments-list');
    var count = document.getElementById('comments-count');
    if (count && list) count.textContent = list.querySelectorAll('.comment-item:not(.comment-reply)').length;
  }

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
        '<button id="like-btn" class="like-btn" type="button" aria-pressed="false" title="J\'aime cet article">' +
          '<span class="like-heart">🤍</span>' +
          '<span class="like-label">J\'aime</span>' +
          '<span class="like-count-wrap">(<span id="like-count">…</span>)</span>' +
        '</button>' +
        '<button id="share-btn" class="share-btn" type="button">🔗 Partager</button>' +
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
          '<button type="button" class="btn-comment-submit">Publier le commentaire</button>' +
        '</form>' +
      '</div>' +

    '</div>';
  }

})();
