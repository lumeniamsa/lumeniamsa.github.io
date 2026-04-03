/* ═══════════════════════════════════════════════════════════════
   Lumenia — Script principal partagé
   Hamburger, back-to-top, fade-in, dark mode,
   loadListing() pour les pages de listing
   ═══════════════════════════════════════════════════════════════ */

/* ── Initialisation immédiate du thème (évite le flash) ── */
(function () {
  if (localStorage.getItem('lumenia_dark') === '1') {
    document.documentElement.classList.add('dark');
  }
})();

(function () {
  'use strict';

  /* ── Hamburger menu ── */
  var hamburger = document.getElementById('hamburger');
  var mobileMenu = document.getElementById('mobile-menu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', function () {
      var open = mobileMenu.classList.toggle('open');
      hamburger.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (e) {
      if (mobileMenu.classList.contains('open') &&
          !hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
        mobileMenu.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ── Header shadow on scroll ── */
  var header = document.querySelector('.site-header');
  if (header) {
    window.addEventListener('scroll', function () {
      header.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
  }

  /* ── Back to top ── */
  var backToTop = document.getElementById('back-to-top');
  if (backToTop) {
    window.addEventListener('scroll', function () {
      backToTop.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ── Fade-in on scroll ── */
  var fadeEls = document.querySelectorAll('.fade-in');
  if (fadeEls.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    fadeEls.forEach(function (el) { io.observe(el); });
  } else {
    fadeEls.forEach(function (el) { el.classList.add('visible'); });
  }

  /* ── Dark mode ── */
  function isDark() {
    return document.documentElement.classList.contains('dark');
  }

  function applyDarkToggleIcon(btn) {
    if (!btn) return;
    btn.textContent = isDark() ? '☀️' : '🌙';
    btn.setAttribute('title', isDark() ? 'Passer en mode clair' : 'Passer en mode sombre');
    btn.setAttribute('aria-label', isDark() ? 'Passer en mode clair' : 'Passer en mode sombre');
  }

  function toggleDark() {
    var dark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('lumenia_dark', dark ? '1' : '0');
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      applyDarkToggleIcon(btn);
    });
  }

  function injectDarkToggle() {
    var siteHeader = document.querySelector('.site-header');
    if (!siteHeader) return;

    /* Bouton dans le header (desktop) */
    if (!document.getElementById('dark-toggle')) {
      var btn = document.createElement('button');
      btn.id = 'dark-toggle';
      btn.className = 'theme-toggle';
      btn.setAttribute('type', 'button');
      applyDarkToggleIcon(btn);
      btn.addEventListener('click', toggleDark);

      /* Insérer avant le hamburger (qu'il soit dans le nav ou dans le header) */
      var hbg = siteHeader.querySelector('.hamburger');
      if (hbg) {
        hbg.parentElement.insertBefore(btn, hbg);
      } else {
        siteHeader.appendChild(btn);
      }
    } else {
      applyDarkToggleIcon(document.getElementById('dark-toggle'));
      document.getElementById('dark-toggle').addEventListener('click', toggleDark);
    }

    /* Bouton dans le menu mobile */
    var mm = document.getElementById('mobile-menu');
    if (mm && !document.getElementById('dark-toggle-mobile')) {
      var mobileBtn = document.createElement('button');
      mobileBtn.id = 'dark-toggle-mobile';
      mobileBtn.className = 'theme-toggle theme-toggle-mobile';
      mobileBtn.setAttribute('type', 'button');
      applyDarkToggleIcon(mobileBtn);
      mobileBtn.addEventListener('click', toggleDark);
      mm.appendChild(mobileBtn);
    }
  }

  injectDarkToggle();

  /* ── Active nav link ── */
  var currentPath = window.location.pathname.replace(/\/$/, '');
  document.querySelectorAll('.site-nav a, .mobile-menu a').forEach(function (a) {
    var href = (a.getAttribute('href') || '').replace(/\/$/, '');
    if (href && currentPath.startsWith(href)) a.classList.add('active');
  });

  /* ── Active bottom nav link ── */
  document.querySelectorAll('.bottom-nav a').forEach(function (a) {
    var href = (a.getAttribute('href') || '').replace(/\/$/, '');
    if (href === '' || href === '/') {
      if (currentPath === '' || currentPath === '/') a.classList.add('active');
    } else if (href && currentPath.startsWith(href)) {
      a.classList.add('active');
    }
  });

})();

/* ═══════════════════════════════════════════════════════════════
   loadListing({ dataUrl, emptyLabel })
   Utilisé par articles/index.html, formations/index.html,
   videos/index.html, communaute/index.html
   ═══════════════════════════════════════════════════════════════ */
function loadListing(opts) {
  var dataUrl    = opts.dataUrl    || '';
  var emptyLabel = opts.emptyLabel || 'Aucun contenu disponible pour l\'instant.';

  var container  = document.getElementById('listing-container');
  var countEl    = document.getElementById('listing-count');
  var filterBar  = document.getElementById('filter-bar');
  var searchInput = document.getElementById('search-input');

  if (!container) return;

  var allItems = [];
  var activeCategory = 'Tous';

  function safe(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderCard(item) {
    return '<a class="article-card" href="' + safe(item.url) + '">' +
      '<div class="card-top">' +
        '<span class="card-cat">' + safe(item.category || '') + '</span>' +
        (item.date ? '<span class="card-read-time">' + safe(item.date) + '</span>' : '') +
      '</div>' +
      '<span class="card-icon">' + (item.icon || '📄') + '</span>' +
      '<h3 class="card-title">' + safe(item.title || 'Sans titre') + '</h3>' +
      (item.description ? '<p class="card-desc">' + safe(item.description) + '</p>' : '') +
      '<div class="card-footer"><span></span><span class="card-arrow">→</span></div>' +
    '</a>';
  }

  function filterAndRender() {
    var query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    var filtered = allItems.filter(function (it) {
      var matchCat = activeCategory === 'Tous' || it.category === activeCategory;
      var matchSearch = !query ||
        (it.title || '').toLowerCase().includes(query) ||
        (it.description || '').toLowerCase().includes(query) ||
        (it.category || '').toLowerCase().includes(query);
      return matchCat && matchSearch;
    });

    if (!filtered.length) {
      container.innerHTML = '<div class="empty" style="text-align:center;padding:60px 20px;color:var(--muted)">' +
        '<span style="font-size:2.5rem">📭</span>' +
        '<p style="margin-top:16px">' + safe(emptyLabel) + '</p>' +
      '</div>';
      if (countEl) countEl.textContent = '0 résultat';
      return;
    }

    container.innerHTML = '<div class="cards-grid">' +
      filtered.map(renderCard).join('') +
    '</div>';

    if (countEl) {
      var n = filtered.length;
      countEl.textContent = n + ' contenu' + (n > 1 ? 's' : '') + ' disponible' + (n > 1 ? 's' : '');
    }
  }

  function buildFilterBar(items) {
    if (!filterBar) return;
    var cats = ['Tous'];
    items.forEach(function (it) {
      if (it.category && cats.indexOf(it.category) === -1) cats.push(it.category);
    });
    if (cats.length <= 2) { filterBar.innerHTML = ''; return; }
    filterBar.innerHTML = cats.map(function (cat) {
      return '<button class="filter-chip' + (cat === activeCategory ? ' active' : '') + '" data-cat="' + safe(cat) + '">' + safe(cat) + '</button>';
    }).join('');
    filterBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter-chip');
      if (!btn) return;
      activeCategory = btn.dataset.cat;
      filterBar.querySelectorAll('.filter-chip').forEach(function (b) {
        b.classList.toggle('active', b.dataset.cat === activeCategory);
      });
      filterAndRender();
    });
  }

  container.innerHTML = '<p style="text-align:center;padding:60px 0;color:var(--muted)">Chargement…</p>';

  fetch(dataUrl)
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (items) {
      allItems = Array.isArray(items) ? items : [];

      if (!allItems.length) {
        container.innerHTML = '<div class="empty" style="text-align:center;padding:60px 20px;color:var(--muted)">' +
          '<span style="font-size:2.5rem">📂</span>' +
          '<p style="margin-top:16px">' + safe(emptyLabel) + '</p>' +
        '</div>';
        if (countEl) countEl.textContent = '0 contenu';
        return;
      }

      buildFilterBar(allItems);

      if (searchInput) {
        searchInput.addEventListener('input', filterAndRender);
      }

      filterAndRender();
    })
    .catch(function (err) {
      container.innerHTML = '<div class="empty" style="text-align:center;padding:60px 20px;color:var(--muted)">' +
        '<span style="font-size:2rem">⚠️</span>' +
        '<p style="margin-top:12px">Impossible de charger le contenu.<br><small>' + safe(err.message) + '</small></p>' +
      '</div>';
      if (countEl) countEl.textContent = '—';
    });
}
