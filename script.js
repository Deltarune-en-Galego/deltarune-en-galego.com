(function () {
  'use strict';
 // código preciso para pillar as patch notes e a release da ultima version en giyhub
  var GITHUB_REPO = 'Deltarune-en-Galego/deltarune-en-galego';
  var CACHE_KEY = 'deg:latest-release';
  var CACHE_TTL_MS = 60 * 60 * 1000; // 1 h - a API de GitHub permite 60 peticións/hora por IP.
  var MONTHS_GL = ['xaneiro', 'febreiro', 'marzo', 'abril', 'maio', 'xuño',
    'xullo', 'agosto', 'setembro', 'outubro', 'novembro', 'decembro'];

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // inline markdown sobre texto XA escapado: mencións, ligazóns, negra e cursiva.
  // a URL exclúe comiñas e < >: así non se pode saír do atributo href.
  function renderInline(escaped) {
    return escaped
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)"'<>]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])_([^_]+)_(?=$|[\s.,;:!?)])/g, '$1<em>$2</em>')
      .replace(/@([a-zA-Z0-9-]+)/g,
        '<a href="https://github.com/$1" target="_blank" rel="noopener">@$1</a>');
  }

  // renderiza o markdown das release notes de github
  function renderPatchNotes(markdown) {
    var lines = markdown.replace(/\r\n/g, '\n').split('\n');
    var html = '';
    var inList = false;

    function closeList() {
      if (inList) { html += '</ul>'; inList = false; }
    }

    lines.forEach(function (rawLine) {
      var line = rawLine.trim();

      if (line === '') { closeList(); return; }

      var heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        closeList();
        html += '<h3>' + renderInline(escapeHtml(heading[2])) + '</h3>';
        return;
      }

      var item = line.match(/^[-*]\s+(.*)$/);
      if (item) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += '<li>' + renderInline(escapeHtml(item[1])) + '</li>';
        return;
      }

      closeList();
      html += '<p>' + renderInline(escapeHtml(line)) + '</p>';
    });

    closeList();
    return html;
  }

  function formatDateGl(isoDate) {
    var d = new Date(isoDate);
    return d.getDate() + ' de ' + MONTHS_GL[d.getMonth()] + ' de ' + d.getFullYear();
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (Date.now() - entry.time > CACHE_TTL_MS) return null;
      return entry.data;
    } catch (err) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), data: data }));
    } catch (err) {
      // erm awkward
    }
  }

  function applyRelease(release) {
    var versionMeta = document.getElementById('version-meta');
    var notesBody = document.getElementById('patch-notes-body');

    if (versionMeta) {
      versionMeta.innerHTML = 'Versión <strong>' + escapeHtml(release.tag_name) + '</strong>' +
        (release.name ? ' &middot; "' + escapeHtml(release.name) + '"' : '') +
        ' &middot; publicada o ' + formatDateGl(release.published_at);
    }
    if (notesBody && release.body) {
      notesBody.innerHTML = renderPatchNotes(release.body);
    }
  }

  function loadLatestRelease() {
    if (!document.getElementById('version-meta') && !document.getElementById('patch-notes-body')) return;

    var cached = readCache();
    if (cached) {
      applyRelease(cached);
      return;
    }

    fetch('https://api.github.com/repos/' + GITHUB_REPO + '/releases/latest')
      .then(function (res) {
        if (!res.ok) throw new Error('GitHub API error ' + res.status);
        return res.json();
      })
      .then(function (release) {
        var slim = {
          tag_name: release.tag_name,
          name: release.name,
          published_at: release.published_at,
          body: release.body
        };
        writeCache(slim);
        applyRelease(slim);
      })
      .catch(function (err) {
        console.warn('Non se puideron cargar os datos da última versión:', err);
      });
  }

  function initGallery() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.gallery-item'));
    var lightbox = document.getElementById('lightbox');
    if (!items.length || !lightbox) return;

    var image = document.getElementById('lightbox-image');
    var closeBtn = document.getElementById('lightbox-close');
    var prevBtn = document.getElementById('lightbox-prev');
    var nextBtn = document.getElementById('lightbox-next');
    var focusables = [closeBtn, prevBtn, nextBtn];
    var currentIndex = 0;
    var lastFocused = null;

    function show(index) {
      currentIndex = (index + items.length) % items.length;
      var item = items[currentIndex];
      image.src = item.getAttribute('data-full');
      image.alt = item.querySelector('img').alt;
    }

    function open(index) {
      lastFocused = document.activeElement;
      show(index);
      lightbox.hidden = false;
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    }

    function close() {
      lightbox.hidden = true;
      document.body.style.overflow = '';
      // devolve o foco á miniatura da que se abriu
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    // mantén o tabulador dentro do diálogo mentres está aberto
    function trapFocus(event) {
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (focusables.indexOf(document.activeElement) === -1) {
        event.preventDefault();
        first.focus();
      }
    }

    items.forEach(function (item, index) {
      item.addEventListener('click', function () { open(index); });
    });

    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', function () { show(currentIndex - 1); });
    nextBtn.addEventListener('click', function () { show(currentIndex + 1); });

    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox) close();
    });

    document.addEventListener('keydown', function (event) {
      if (lightbox.hidden) return;
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowLeft') show(currentIndex - 1);
      if (event.key === 'ArrowRight') show(currentIndex + 1);
      if (event.key === 'Tab') trapFocus(event);
    });
  }

  function respectReducedMotion() {
    var video = document.querySelector('.hero-bg');
    if (!video || !window.matchMedia) return;

    var query = window.matchMedia('(prefers-reduced-motion: reduce)');

    function sync() {
      if (query.matches) {
        video.pause();
      } else if (video.paused) {
        var attempt = video.play();
        if (attempt && attempt.catch) attempt.catch(function () { /* autoplay bloqueado */ });
      }
    }

    sync();
    if (query.addEventListener) query.addEventListener('change', sync);
  }

  function init() {
    var year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();

    loadLatestRelease();
    initGallery();
    respectReducedMotion();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
