/* Рантайм, который вшивается в каждый сгенерированный сайт.
   Задача: сайт должен работать даже там, где модель ошиблась или что-то не подгрузилось. */
(function () {
  var pool = window.__nsPhotoPool || [];
  var STATS = window.__nsStats = { revealed: 0, stubs: 0, menu: false, forms: 0, anchors: 0, unstuck: 0 };
  document.documentElement.classList.add('ns-js-ready');

  /* --- фотографии: подмена битых ссылок на проверенные из пула --- */
  window.nsImgError = function (img, idx) {
    try {
      var next = pool[(parseInt(idx || '0', 10) + 1) % Math.max(pool.length, 1)] || pool[0];
      if (next && img.dataset.nsTried !== '2') { img.dataset.nsTried = '2'; img.src = next; return; }
      var wrap = document.createElement('div');
      wrap.className = 'ns-img-fallback';
      wrap.textContent = img.getAttribute('alt') || 'фото';
      if (img.parentNode) img.parentNode.replaceChild(wrap, img);
    } catch (e) { }
  };
  Array.prototype.forEach.call(document.images, function (img, i) {
    if (!img.getAttribute('onerror')) img.setAttribute('onerror', 'nsImgError(this,' + i + ')');
    if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
    if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
  });

  /* --- появление секций при скролле --- */
  function revealInit() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('.ns-reveal:not(.ns-in)'));
    if (!nodes.length) return;
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.classList.add('ns-in'); });
      STATS.revealed += nodes.length;
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('ns-in'); STATS.revealed++; io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    nodes.forEach(function (n, i) { n.style.transitionDelay = Math.min(i, 6) * 60 + 'ms'; io.observe(n); });
  }

  /* Если модель не сделала анимаций — включаем аккуратное появление секций сами. */
  function autoReveal() {
    var hasAnim = window.gsap || window.AOS || window.WOW ||
      document.querySelector('[data-aos],[data-wow],[data-scroll],.animate-on-scroll,.reveal,.ns-reveal');
    if (hasAnim) return;
    var sections = Array.prototype.slice.call(document.querySelectorAll('body > section, main > section, .section'));
    sections.forEach(function (s, i) { if (i > 0 && !s.classList.contains('ns-reveal')) s.classList.add('ns-reveal'); });
    var cards = Array.prototype.slice.call(document.querySelectorAll('.card, .feature, [class*="card"]')).slice(0, 24);
    cards.forEach(function (c) { if (!c.classList.contains('ns-reveal')) c.classList.add('ns-reveal'); });
  }

  /* --- страховка: контент обязан быть видимым, даже если анимация не сработала --- */
  function safetyNet() {
    var i, el, stuck = 0;
    function transparent(node) {
      var st = getComputedStyle(node);
      return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity) === 0;
    }
    var cands = document.querySelectorAll(
      '.ns-reveal:not(.ns-in), .animate-on-scroll:not(.visible):not(.is-visible):not(.animate-in),' +
      '.reveal:not(.visible):not(.is-visible), .fade-in:not(.visible):not(.is-visible), [data-animate]:not(.visible)'
    );
    for (i = 0; i < cands.length; i++) {
      el = cands[i];
      if (!transparent(el)) continue;
      el.style.transition = 'opacity .6s ease, transform .6s ease';
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.classList.add('ns-in');
      stuck++;
    }
    var host = document.body.querySelectorAll('section,article,div,li,h2,h3,p');
    for (i = 0; i < host.length; i++) {
      el = host[i];
      if (el.dataset.nsUnstuck) continue;
      var cls = String(el.className || '');
      if (/modal|menu|overlay|popup|drawer|tooltip|backdrop|lightbox|cursor|loader|spinner|toast/i.test(cls)) continue;
      var st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.position === 'fixed' || st.position === 'absolute') continue;
      if (parseFloat(st.opacity) === 0 && el.offsetHeight > 8 && el.offsetWidth > 8) {
        el.dataset.nsUnstuck = '1';
        el.style.transition = 'opacity .5s ease';
        el.style.opacity = '1';
        stuck++;
      }
    }
    STATS.unstuck += stuck;
  }

  /* --- мобильное меню --- */
  function menuInit() {
    var toggle = document.querySelector('[data-menu-toggle], #burger, .burger, .hamburger, #hamburger, [aria-label*="меню"], [aria-label*="Menu"]');
    if (!toggle) {
      toggle = Array.prototype.slice.call(document.querySelectorAll('header button, header a')).filter(function (b) {
        return /☰|≡|меню|menu/i.test((b.textContent || '') + ' ' + (b.getAttribute('aria-label') || ''));
      })[0];
    }
    if (!toggle) return;
    var menu = document.querySelector('#mobileMenu, #mobile-menu, #navMenu, .mobile-menu, .nav-menu, .nav-mobile, nav[data-mobile]');
    var owned = false;
    if (!menu) {
      menu = document.querySelector('header nav');
      if (!menu) return;
      menu = menu.cloneNode(true);
      menu.className = 'ns-mobile-menu';
      menu.id = 'ns-mobile-menu';
      menu.style.cssText = 'display:none;flex-direction:column;gap:14px;padding:18px 20px;background:rgba(12,14,24,.97);position:absolute;left:0;right:0;top:100%;z-index:80';
      var host = toggle.closest('header') || document.body;
      host.style.position = host.style.position || 'relative';
      host.appendChild(menu);
      owned = true;
    }
    var opened = false;
    var originalDisplay = menu.style.display;
    function setOpen(v) {
      opened = v;
      menu.style.display = v ? 'flex' : (owned ? 'none' : originalDisplay);
      toggle.setAttribute('aria-expanded', v ? 'true' : 'false');
    }
    setOpen(false);
    toggle.addEventListener('click', function (e) { e.preventDefault(); setOpen(!opened); });
    menu.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) setOpen(false); });
    document.addEventListener('click', function (e) { if (opened && !menu.contains(e.target) && !toggle.contains(e.target)) setOpen(false); });
    STATS.menu = true;
  }

  /* --- мягкий скролл к якорям --- */
  function anchorInit() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = (a.getAttribute('href') || '').slice(1);
      if (!id) return;
      var target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      var header = document.querySelector('header');
      var offset = header ? header.getBoundingClientRect().height + 8 : 0;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - offset, behavior: 'smooth' });
      STATS.anchors++;
    }, true);
  }

  /* --- активный пункт меню --- */
  function activeNav() {
    var links = Array.prototype.slice.call(document.querySelectorAll('header a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (l) {
      var t = document.getElementById((l.getAttribute('href') || '').slice(1));
      if (t) map[t.id] = l;
    });
    if (!Object.keys(map).length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (l) { l.classList.remove('ns-active'); });
        if (map[e.target.id]) map[e.target.id].classList.add('ns-active');
      });
    }, { threshold: 0.4 });
    Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
  }

  /* --- аккордеоны / FAQ --- */
  function accordionInit() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-accordion] > *, .faq-item, .accordion-item'), function (item) {
      if (item.dataset.nsBound) return;
      var head = item.querySelector('.faq-q, .accordion-head, .accordion-header, [data-accordion-head], h3, h4, button');
      var body = item.querySelector('.faq-a, .accordion-body, [data-accordion-body], .answer, .accordion-content');
      if (!head || !body) return;
      item.dataset.nsBound = '1';
      body.style.display = 'none';
      head.style.cursor = 'pointer';
      head.addEventListener('click', function () {
        var open = body.style.display === 'none';
        body.style.display = open ? 'block' : 'none';
        item.classList.toggle('ns-open', open);
      });
    });
  }

  /* --- формы: валидация + окно благодарности --- */
  function successModal(title, text) {
    var m = document.createElement('div');
    m.className = 'ns-modal';
    m.innerHTML = '<div class="ns-modal-card"><div style="font-size:34px">✅</div>' +
      '<h3 style="margin:10px 0 6px;font-size:20px">' + title + '</h3>' +
      '<p style="margin:0;color:#555;font-size:14px">' + text + '</p>' +
      '<button style="margin-top:18px;padding:12px 26px;border:0;border-radius:12px;background:#111;color:#fff;cursor:pointer;font-weight:600">Отлично</button></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m || e.target.tagName === 'BUTTON') m.remove(); });
  }
  function bindForms(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('form'), function (f) {
      if (f.dataset.nsBound) return;
      f.dataset.nsBound = '1';
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var bad = null;
        Array.prototype.forEach.call(f.querySelectorAll('[required]'), function (inp) {
          if (!bad && !String(inp.value || '').trim()) bad = inp;
        });
        if (bad) { bad.focus(); bad.style.outline = '2px solid #e5484d'; return; }
        var tel = f.querySelector('[type=tel], [name*=tel], [name*=phone]');
        if (tel && tel.value && String(tel.value).replace(/\D/g, '').length < 10) {
          tel.focus(); tel.style.outline = '2px solid #e5484d'; return;
        }
        var btn = f.querySelector('[type=submit], button');
        if (btn) { btn.disabled = true; btn.dataset.nsText = btn.textContent; btn.textContent = 'Отправляем...'; }
        setTimeout(function () {
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.nsText || 'Отправить'; }
          f.reset();
          successModal('Заявка отправлена', 'Спасибо! Мы свяжемся с вами в течение рабочего дня.');
        }, 900);
        STATS.forms++;
      });
    });
  }

  /* --- параллакс, счётчики, кнопка наверх --- */
  function extras() {
    var layers = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]')).slice(0, 6);
    if (layers.length) {
      var onScroll = function () {
        var y = window.pageYOffset;
        layers.forEach(function (el) {
          var s = parseFloat(el.getAttribute('data-parallax')) || 0.15;
          el.style.transform = 'translate3d(0,' + (-y * s).toFixed(1) + 'px,0)';
        });
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-count]'), function (el) {
      var to = parseFloat(el.getAttribute('data-count')) || 0, started = false;
      function run() {
        if (started) return;
        started = true;
        var t0 = performance.now();
        (function tick() {
          var p = Math.min(1, (performance.now() - t0) / 1200);
          el.textContent = Math.round(to * (0.2 + 0.8 * p));
          if (p < 1) requestAnimationFrame(tick); else el.textContent = to;
        })();
      }
      if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { if (e[0].isIntersecting) run(); }).observe(el);
      else run();
    });
    var top = document.createElement('button');
    top.className = 'ns-to-top';
    top.innerHTML = '↑';
    top.setAttribute('aria-label', 'Наверх');
    top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    document.body.appendChild(top);
    window.addEventListener('scroll', function () { top.classList.toggle('ns-show', window.pageYOffset > 700); }, { passive: true });
  }

  /* --- заглушки для несуществующих функций (мёртвых кнопок быть не должно) --- */
  function stubs() {
    var re = /on(?:click|submit|change)\s*=\s*"\s*([A-Za-z_$][\w$]*)\s*\(/g;
    var html = document.documentElement.innerHTML, m, names = {};
    while ((m = re.exec(html))) names[m[1]] = true;
    Object.keys(names).forEach(function (name) {
      if (typeof window[name] === 'function') return;
      window[name] = function () {
        successModal('Скоро здесь будет раздел', 'Эта кнопка ведёт на страницу, которую ещё не сверстали. Напишите в чат генератора — сделаем.');
      };
      STATS.stubs++;
    });
  }

  /* --- многостраничник: ссылки на *.html переключают файлы в предпросмотре --- */
  function multiPreview() {
    if (!window.__nsMulti) return;
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href$=".html"]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || /^https?:/i.test(href)) return;
      e.preventDefault();
      try { parent.postMessage({ type: 'ns-goto', file: href.replace(/^\.\//, '') }, '*'); } catch (err) { }
    }, true);
  }

  function boot() {
    autoReveal();
    revealInit();
    menuInit();
    anchorInit();
    activeNav();
    accordionInit();
    bindForms(document);
    extras();
    stubs();
    multiPreview();
    setTimeout(safetyNet, 1200);
    setTimeout(safetyNet, 3000);
    window.addEventListener('beforeprint', safetyNet);
    window.addEventListener('load', function () { safetyNet(); setTimeout(revealInit, 300); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) safetyNet(); });
    var header = document.querySelector('header');
    if (header) {
      window.addEventListener('scroll', function () { header.classList.toggle('ns-scrolled', window.pageYOffset > 12); }, { passive: true });
    }
    window.__nsReady = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
