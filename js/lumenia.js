/* ═══════════════════════════════════════════════════════════════
   Lumenia — JS partagé (nav, search, animations, back-to-top, thème)
   ═══════════════════════════════════════════════════════════════ */

/* ── Thème sombre : application immédiate (avant rendu) ── */
(function () {
  var saved = localStorage.getItem('lumenia-theme');
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
})();

(function () {
  'use strict';

  /* ── Hamburger menu ── */
  var hamburger  = document.getElementById('hamburger');
  var mobileMenu = document.getElementById('mobile-menu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = mobileMenu.classList.toggle('open');
      hamburger.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (e) {
      if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
        mobileMenu.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ── Header scroll shadow ── */
  var header = document.querySelector('.site-header');
  if (header) {
    window.addEventListener('scroll', function () {
      header.classList.toggle('scrolled', window.scrollY > 8);
    }, { passive: true });
  }

  /* ── Bouton thème sombre/clair ── */
  (function () {
    var header = document.querySelector('.site-header');
    if (!header) return;

    var btn = document.createElement('button');
    btn.id = 'theme-toggle';
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Changer le thème');
    btn.title = 'Mode sombre / clair';

    function setIcon() {
      btn.textContent = document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
    }
    setIcon();

    btn.addEventListener('click', function () {
      var isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('lumenia-theme', isDark ? 'dark' : 'light');
      setIcon();
    });

    /* Insérer avant le hamburger (ou à la fin du header) */
    var hamburger = document.getElementById('hamburger');
    if (hamburger) header.insertBefore(btn, hamburger);
    else header.appendChild(btn);
  })();

  /* ── Active nav link ── */
  var path = window.location.pathname;
  document.querySelectorAll('.site-nav a, .mobile-menu a, .bottom-nav a').forEach(function (a) {
    var href = a.getAttribute('href');
    if (!href) return;
    var isHome = href === '/' && path === '/';
    var isSub  = href !== '/' && path.startsWith(href);
    if (isHome || isSub) a.classList.add('active');
  });

  /* ── Back to top ── */
  var btt = document.getElementById('back-to-top');
  if (btt) {
    window.addEventListener('scroll', function () {
      btt.classList.toggle('visible', window.scrollY > 380);
    }, { passive: true });
    btt.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ── Fade-in on scroll ── */
  var fadeEls = document.querySelectorAll('.fade-in');
  if (fadeEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    fadeEls.forEach(function (el) { io.observe(el); });
  }

  /* ── Read time estimator ── */
  window.estimateReadTime = function (text) {
    var words = (text || '').trim().split(/\s+/).length;
    var mins  = Math.max(1, Math.round(words / 220));
    return mins + ' min';
  };

  /* ── Listing from data.json ── */
  window.loadListing = function (opts) {
    var container   = document.getElementById(opts.containerId || 'listing-container');
    var counter     = document.getElementById(opts.counterId   || 'listing-count');
    var searchInput = document.getElementById(opts.searchId    || 'search-input');
    var filterBar   = document.getElementById(opts.filterId    || 'filter-bar');
    var dataUrl     = opts.dataUrl;
    var emptyLabel  = opts.emptyLabel || 'Aucun contenu disponible pour l\'instant.';
    var allItems    = [];

    if (!container) return;

    container.innerHTML = '<p style="text-align:center;padding:48px 0;color:#adb5bd">Chargement…</p>';

    fetch(dataUrl)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (items) {
        allItems = items;
        buildFilters(items);
        render(items);
      })
      .catch(function () {
        container.innerHTML = buildEmpty(emptyLabel);
        if (counter) counter.textContent = '0 contenu disponible';
      });

    function buildFilters(items) {
      if (!filterBar) return;
      var cats = ['Tous'];
      items.forEach(function (it) {
        var c = it.category || 'Article';
        if (cats.indexOf(c) === -1) cats.push(c);
      });
      if (cats.length <= 2) { filterBar.style.display = 'none'; return; }
      filterBar.innerHTML = cats.map(function (c) {
        return '<button class="filter-chip' + (c === 'Tous' ? ' active' : '') + '" data-cat="' + escAttr(c) + '">' + esc(c) + '</button>';
      }).join('');
      filterBar.addEventListener('click', function (e) {
        var btn = e.target.closest('.filter-chip');
        if (!btn) return;
        filterBar.querySelectorAll('.filter-chip').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        applyFilters();
      });
    }

    function applyFilters() {
      var q          = searchInput ? searchInput.value.toLowerCase().trim() : '';
      var activeChip = filterBar ? filterBar.querySelector('.filter-chip.active') : null;
      var cat        = activeChip ? activeChip.dataset.cat : 'Tous';
      var filtered   = allItems.filter(function (it) {
        var matchCat = cat === 'Tous' || (it.category || 'Article') === cat;
        var matchQ   = !q || (it.title || '').toLowerCase().includes(q) || (it.category || '').toLowerCase().includes(q);
        return matchCat && matchQ;
      });
      render(filtered);
    }

    function render(items) {
      if (counter) {
        counter.textContent = items.length + ' contenu' + (items.length !== 1 ? 's' : '') + ' disponible' + (items.length !== 1 ? 's' : '');
      }
      if (!items.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📂</div><p>' + esc(emptyLabel) + '</p></div>';
        return;
      }
      container.innerHTML = '<div class="cards-grid">' + items.map(buildCard).join('') + '</div>';
      container.querySelectorAll('.fade-in').forEach(function (el) {
        requestAnimationFrame(function () { el.classList.add('visible'); });
      });
    }

    function buildCard(item) {
      var cat  = item.category || 'Article';
      var icon = item.icon || '📝';
      var date = item.date || '';
      var desc = item.description || item.excerpt || '';
      var url  = item.url || '#';
      return '<a class="article-card fade-in" href="' + escAttr(url) + '">' +
        '<div class="card-top"><span class="card-cat">' + esc(cat) + '</span>' +
        (date ? '<span class="card-read-time">' + esc(date) + '</span>' : '') +
        '</div>' +
        '<span class="card-icon">' + icon + '</span>' +
        '<h3 class="card-title">' + esc(item.title || 'Sans titre') + '</h3>' +
        (desc ? '<p class="card-desc">' + esc(desc) + '</p>' : '') +
        '<div class="card-footer"><span class="card-date"></span><span class="card-arrow">→</span></div>' +
        '</a>';
    }

    if (searchInput) searchInput.addEventListener('input', applyFilters);

    function buildEmpty(msg) {
      return '<div class="empty-state"><div class="empty-icon">📂</div><p>' + esc(msg) + '</p></div>';
    }
    function esc(s)     { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function escAttr(s) { return String(s).replace(/"/g,'&quot;'); }
  };

})();
