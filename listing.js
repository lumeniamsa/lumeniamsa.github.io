/**
 * listing.js — Lumenia
 * Affiche dynamiquement les fichiers d'une section via l'API GitHub.
 * Utilisé uniquement sur GitHub Pages (sur Replit, server.py gère le listing).
 */
(function () {
  var IGNORED = ['index.html', 'modele-article.html', 'articles.js', 'listing.js', 'data.json', '404.html'];
  var IGNORED_EXT = ['.js', '.json', '.css', '.py', '.txt', '.md5'];

  function githubUser() {
    return window.location.hostname.split('.')[0];
  }
  function githubRepo() {
    return window.location.hostname; // ex: lumeniamsa.github.io
  }
  function currentSection() {
    var parts = window.location.pathname.replace(/\/$/, '').split('/').filter(Boolean);
    return parts[0] || '';
  }

  function apiUrl(path) {
    return 'https://api.github.com/repos/' + githubUser() + '/' + githubRepo() + '/contents/' + path;
  }

  function isAllowed(entry) {
    if (IGNORED.indexOf(entry.name) !== -1) return false;
    var ext = entry.name.lastIndexOf('.') !== -1 ? entry.name.slice(entry.name.lastIndexOf('.')) : '';
    if (IGNORED_EXT.indexOf(ext) !== -1) return false;
    return true;
  }

  function fileHref(entry, section) {
    var ext = entry.name.lastIndexOf('.') !== -1 ? entry.name.slice(entry.name.lastIndexOf('.')) : '';
    if (ext === '.md') {
      return '/viewer.html?file=' + entry.path;
    }
    return '/' + entry.path;
  }

  function fileLabel(entry) {
    var base = entry.name.lastIndexOf('.') !== -1 ? entry.name.slice(0, entry.name.lastIndexOf('.')) : entry.name;
    return base.replace(/[-_]/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function fileIcon(entry) {
    var ext = entry.name.lastIndexOf('.') !== -1 ? entry.name.slice(entry.name.lastIndexOf('.')) : '';
    return ext === '.md' ? '📝' : '📄';
  }

  function fileType(entry) {
    var ext = entry.name.lastIndexOf('.') !== -1 ? entry.name.slice(entry.name.lastIndexOf('.')) : '';
    return ext === '.md' ? 'Markdown' : 'HTML';
  }

  function renderCards(items, section) {
    return items.map(function (entry) {
      return '<a class="listing-card" href="' + fileHref(entry, section) + '">' +
        '<span class="icon">' + fileIcon(entry) + '</span>' +
        '<span class="name">' + fileLabel(entry) + '</span>' +
        '<span class="type">' + fileType(entry) + '</span>' +
        '</a>';
    }).join('');
  }

  function renderCategory(label, items, section) {
    if (!items.length) return '';
    return '<h2 class="category-title">' + label + '</h2>' +
      '<div class="listing-grid">' + renderCards(items, section) + '</div>';
  }

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function init() {
    var container = document.getElementById('listing-container');
    var counter   = document.getElementById('listing-count');
    if (!container) return;

    var section = currentSection();
    if (!section) return;

    container.innerHTML = '<p style="color:#888;text-align:center;padding:40px 0">Chargement…</p>';

    fetchJson(apiUrl(section))
      .then(function (entries) {
        var rootFiles = entries.filter(function (e) { return e.type === 'file' && isAllowed(e); });
        var dirs      = entries.filter(function (e) { return e.type === 'dir'; });

        // Récupérer les fichiers de chaque sous-dossier
        var dirFetches = dirs.map(function (dir) {
          return fetchJson(apiUrl(dir.path)).then(function (sub) {
            return { label: dir.name.replace(/[-_]/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }),
                     files: sub.filter(function (e) { return e.type === 'file' && isAllowed(e); }) };
          });
        });

        return Promise.all(dirFetches).then(function (categories) {
          return { rootFiles: rootFiles, categories: categories };
        });
      })
      .then(function (data) {
        var total = data.rootFiles.length + data.categories.reduce(function (s, c) { return s + c.files.length; }, 0);

        if (counter) {
          counter.textContent = total + ' contenu' + (total !== 1 ? 's' : '') + ' disponible' + (total !== 1 ? 's' : '');
        }

        if (total === 0) {
          container.innerHTML = '<div class="empty"><span style="font-size:2.5rem">📂</span>' +
            '<p>Aucun contenu disponible pour l\'instant.</p></div>';
          return;
        }

        var html = '';
        if (data.rootFiles.length) {
          html += '<div class="listing-grid">' + renderCards(data.rootFiles, section) + '</div>';
        }
        data.categories.forEach(function (cat) {
          html += renderCategory(cat.label, cat.files, section);
        });
        container.innerHTML = html;
      })
      .catch(function (err) {
        container.innerHTML = '<div class="empty"><span style="font-size:2rem">⚠️</span>' +
          '<p>Impossible de charger la liste. Vérifiez votre connexion.<br><small>' + err.message + '</small></p></div>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
