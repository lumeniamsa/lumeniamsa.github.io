/* ═══════════════════════════════════════════════════════════════
   lumenia.js — Script principal partagé
   Navigation · Dark mode · loadListing · Back-to-top · Animations
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─────────────────────────────────────────
     DARK MODE
     ───────────────────────────────────────── */
  var DARK_KEY = 'lumenia-dark';

  function applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.setAttribute('aria-label', dark ? 'Mode clair' : 'Mode nuit');
    if (btn) btn.innerHTML = dark
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }

  function initTheme() {
    var stored = localStorage.getItem(DARK_KEY);
    var dark = stored === '1' || (stored === null && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    applyTheme(dark);

    var btn = document.createElement('button');
    btn.id = 'theme-toggle';
    btn.className = 'theme-toggle';
    btn.title = 'Changer le thème';
    btn.setAttribute('aria-label', dark ? 'Mode clair' : 'Mode nuit');

    var header = document.querySelector('.site-header, header');
    if (header) {
      var hamburger = header.querySelector('.hamburger');
      if (hamburger) {
        header.insertBefore(btn, hamburger);
      } else {
        header.appendChild(btn);
      }
    }

    applyTheme(dark);

    btn.addEventListener('click', function () {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      var next = !isDark;
      localStorage.setItem(DARK_KEY, next ? '1' : '0');
      applyTheme(next);
    });
  }

  /* ─────────────────────────────────────────
     NAVIGATION — hamburger + scroll + active
     ───────────────────────────────────────── */
  function initNav() {
    var header    = document.querySelector('.site-header, header');
    var hamburger = document.getElementById('hamburger');
    var mobileMenu = document.getElementById('mobile-menu');

    if (hamburger && mobileMenu) {
      hamburger.addEventListener('click', function () {
        var open = hamburger.classList.toggle('open');
        mobileMenu.classList.toggle('open', open);
        hamburger.setAttribute('aria-expanded', open);
      });
      document.addEventListener('click', function (e) {
        if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
          hamburger.classList.remove('open');
          mobileMenu.classList.remove('open');
          hamburger.setAttribute('aria-expanded', false);
        }
      });
    }

    if (header) {
      window.addEventListener('scroll', function () {
        header.classList.toggle('scrolled', window.scrollY > 10);
      }, { passive: true });
    }

    var path = window.location.pathname.replace(/\/$/, '') || '/';
    document.querySelectorAll('.site-nav a, .mobile-menu a, .bottom-nav a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (href === path || (href !== '/' && path.startsWith(href))) {
        a.classList.add('active');
      }
    });
  }

  /* ─────────────────────────────────────────
     BACK TO TOP
     ───────────────────────────────────────── */
  function initBackToTop() {
    var btn = document.getElementById('back-to-top');
    if (!btn) return;
    window.addEventListener('scroll', function () {
      btn.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ─────────────────────────────────────────
     FADE-IN ANIMATION
     ───────────────────────────────────────── */
  function initFadeIn() {
    var els = document.querySelectorAll('.fade-in');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('visible'); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(function (el) { obs.observe(el); });
  }

  /* ─────────────────────────────────────────
     READING PROGRESS BAR
     ───────────────────────────────────────── */
  function initReadingProgress() {
    var bar = document.querySelector('.reading-progress');
    if (!bar) return;
    window.addEventListener('scroll', function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    }, { passive: true });
  }

  /* ─────────────────────────────────────────
     LOAD LISTING
     Reads a data.json and renders article cards
     with search + category filter
     ───────────────────────────────────────── */
  window.loadListing = function (opts) {
    var dataUrl   = opts.dataUrl || '';
    var emptyLabel = opts.emptyLabel || 'Aucun contenu disponible pour l\'instant.';
    var container = document.getElementById('listing-container');
    var counter   = document.getElementById('listing-count');
    var searchInput = document.getElementById('search-input');
    var filterBar  = document.getElementById('filter-bar');

    if (!container) return;

    var allItems = [];
    var activeCategory = 'Tous';

    function safe(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function renderCard(item) {
      var cat  = item.category || 'Article';
      var date = item.date || '';
      var icon = item.icon || '📄';
      var desc = item.description || item.excerpt || '';
      var url  = item.url || '#';
      return '<a class="article-card fade-in" href="' + url + '">' +
        '<div class="card-top">' +
          '<span class="card-cat">' + safe(cat) + '</span>' +
          (date ? '<span class="card-read-time">' + safe(date) + '</span>' : '') +
        '</div>' +
        '<span class="card-icon">' + icon + '</span>' +
        '<h3 class="card-title">' + safe(item.title || 'Sans titre') + '</h3>' +
        (desc ? '<p class="card-desc">' + safe(desc) + '</p>' : '') +
        '<div class="card-footer">' +
          '<span class="card-date">' + safe(date) + '</span>' +
          '<span class="card-arrow">→</span>' +
        '</div>' +
      '</a>';
    }

    function render() {
      var q = searchInput ? searchInput.value.trim().toLowerCase() : '';
      var filtered = allItems.filter(function (item) {
        var matchCat = activeCategory === 'Tous' || item.category === activeCategory;
        var matchQ = !q ||
          (item.title || '').toLowerCase().includes(q) ||
          (item.description || '').toLowerCase().includes(q) ||
          (item.category || '').toLowerCase().includes(q);
        return matchCat && matchQ;
      });

      if (counter) {
        var n = filtered.length;
        counter.textContent = n + ' contenu' + (n !== 1 ? 's' : '') + ' disponible' + (n !== 1 ? 's' : '');
      }

      if (!filtered.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div>' +
          '<p>' + (q || activeCategory !== 'Tous' ? 'Aucun résultat pour cette recherche.' : safe(emptyLabel)) + '</p></div>';
        return;
      }

      container.innerHTML = '<div class="cards-grid">' + filtered.map(renderCard).join('') + '</div>';
      initFadeIn();
    }

    function buildFilterChips(items) {
      if (!filterBar) return;
      var cats = ['Tous'];
      items.forEach(function (it) {
        if (it.category && cats.indexOf(it.category) === -1) cats.push(it.category);
      });
      if (cats.length <= 2) { filterBar.innerHTML = ''; return; }
      filterBar.innerHTML = cats.map(function (c) {
        return '<button class="filter-chip' + (c === 'Tous' ? ' active' : '') + '" data-cat="' + safe(c) + '">' + safe(c) + '</button>';
      }).join('');
      filterBar.querySelectorAll('.filter-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          activeCategory = chip.dataset.cat;
          filterBar.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('active'); });
          chip.classList.add('active');
          render();
        });
      });
    }

    container.innerHTML = '<div class="cards-grid" style="padding:40px 0;text-align:center;grid-column:1/-1"><div class="listing-spinner"></div></div>';
    if (counter) counter.textContent = 'Chargement…';

    fetch(dataUrl)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        allItems = Array.isArray(data) ? data : [];
        buildFilterChips(allItems);

        if (searchInput) {
          searchInput.addEventListener('input', render);
        }

        render();
      })
      .catch(function (err) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div>' +
          '<p>Impossible de charger le contenu.<br><small>' + safe(err.message) + '</small></p></div>';
        if (counter) counter.textContent = '';
      });
  };

  /* ─────────────────────────────────────────
     INIT ON DOM READY
     ───────────────────────────────────────── */
  function init() {
    initTheme();
    initNav();
    initBackToTop();
    initFadeIn();
    initReadingProgress();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
