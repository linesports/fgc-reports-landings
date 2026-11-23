/* LINE · capa de moviment compartida (window.LINE.motion)
 *
 * Càrrega, en aquest ordre i amb defer:
 *   ../comu/vendor/gsap.min.js, ScrollTrigger.min.js, SplitText.min.js, lenis.min.js
 *   ../comu/motion.js
 *   edicio.js, script de la pàgina
 *   script de moviment de la pàgina (IIFE que crida LINE.motion.ready.then(...))
 *
 * Cada landing afegeix motion-ok amb un petit script en línia al <head>, abans del
 * primer pintat, perquè els títols no apareguin sense dividir abans de la revelació.
 *
 * Principis:
 * - El contingut és visible per defecte. Els estats inicials només s’apliquen
 *   sota html.motion-ok i quan les llibreries han carregat.
 * - prefers-reduced-motion: sense Lenis, sense revelacions, sense cursor;
 *   la navegació i l’scrollspy continuen funcionant.
 * - Els efectes de punter només s’activen amb (hover:hover) and (pointer:fine).
 * - Res d’escoltadors de scroll propis: ScrollTrigger i IntersectionObserver.
 */
(function () {
  'use strict';

  var LINE = window.LINE = window.LINE || {};
  if (LINE.motion) return;

  var root = document.documentElement;
  var reduceQ = matchMedia('(prefers-reduced-motion: reduce)');
  var fineQ = matchMedia('(hover: hover) and (pointer: fine)');
  var CDN = 'https://cdn.jsdelivr.net/npm/';
  var FALLBACK = [
    ['gsap', CDN + 'gsap@3.15.1/dist/gsap.min.js'],
    ['ScrollTrigger', CDN + 'gsap@3.15.1/dist/ScrollTrigger.min.js'],
    ['SplitText', CDN + 'gsap@3.15.1/dist/SplitText.min.js'],
    ['Lenis', CDN + 'lenis@1.3.27/dist/lenis.min.js']
  ];
  var EASE = { out: 'expo.out', io: 'power3.inOut', in: 'power3.in', soft: 'power3.out' };
  var DUR = { d1: 0.12, d2: 0.22, d3: 0.42, d4: 0.72 };

  if (!reduceQ.matches) root.classList.add('motion-ok');
  var failsafe = setTimeout(markReady, 3000);
  function markReady() { root.classList.add('motion-ready'); }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  async function ensureLibs() {
    for (var i = 0; i < FALLBACK.length; i++) {
      var name = FALLBACK[i][0];
      if (window[name]) continue;
      try { await loadScript(FALLBACK[i][1]); } catch (e) { /* sense xarxa: es queda estàtic */ }
    }
    return !!(window.gsap && window.ScrollTrigger);
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var domReady = new Promise(function (r) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', r, { once: true });
    else r();
  });

  var numberCache = {};
  function formatter(decimals) {
    var key = String(decimals);
    if (!numberCache[key]) numberCache[key] = new Intl.NumberFormat('ca-ES', { useGrouping: 'always', minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return numberCache[key];
  }
  function decimalsOf(value) {
    var s = String(value), i = s.indexOf('.');
    return i < 0 ? 0 : Math.min(3, s.length - i - 1);
  }
  function toArray(targets) {
    if (!targets) return [];
    if (typeof targets === 'string') return Array.prototype.slice.call(document.querySelectorAll(targets));
    if (targets.length !== undefined && !targets.nodeType) return Array.prototype.slice.call(targets);
    return [targets];
  }

  var api = LINE.motion = {
    enabled: false,   // moviment actiu (llibreries carregades i sense moviment reduït)
    fine: false,      // punter fi amb hover, i moviment actiu
    lenis: null,
    ease: EASE,
    dur: DUR,
    format: function (value, decimals) { return formatter(decimals == null ? decimalsOf(value) : decimals).format(value); },
    ready: null
  };

  /* ---------- Desplaçament ---------- */
  // Posició d'arribada calculada amb la posició real (window.scrollY), no amb l'estat intern de
  // Lenis, que pot quedar endarrerit si el navegador ha mogut la pàgina pel seu compte (focus).
  // Resta scroll-padding-top de l'arrel i scroll-margin-top de l'objectiu, com fa el navegador.
  function targetY(el) {
    var pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    var margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    var max = Math.max(0, root.scrollHeight - window.innerHeight);
    return Math.max(0, Math.min(max, Math.round(el.getBoundingClientRect().top + window.scrollY - pad - margin)));
  }
  api.scrollTo = function (target, opts) {
    opts = opts || {};
    var el = target;
    if (typeof target === 'string') el = (target === '#' || target === '#top') ? 0 : document.querySelector(target);
    if (el == null) return;
    var done = function () {
      if (opts.focus !== false && el && el.nodeType === 1) {
        if (!el.matches('a,button,input,select,textarea,[tabindex]')) el.setAttribute('tabindex', '-1');
        el.focus({ preventScroll: true });
      }
      if (opts.onComplete) opts.onComplete();
    };
    if (api.lenis) {
      api.lenis.scrollTo(typeof el === 'number' ? el : targetY(el), { duration: opts.duration || 1.15, onComplete: done });
    } else {
      var behavior = api.enabled ? 'smooth' : 'auto';
      if (typeof el === 'number') window.scrollTo({ top: el, behavior: behavior });
      else el.scrollIntoView({ behavior: behavior, block: 'start' });
      setTimeout(done, api.enabled ? 650 : 0);
    }
  };
  function wireAnchors() {
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var hash = a.getAttribute('href');
      var target = hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
      if (hash.length > 1 && !target) return;
      e.preventDefault();
      api.scrollTo(target || 0, { focus: !!target });
      if (history.pushState) history.pushState(null, '', hash.length > 1 ? hash : location.pathname + location.search);
    });
  }

  /* ---------- Revelacions de text (només títols) ---------- */
  api.reveal = function (targets, o) {
    o = o || {};
    toArray(targets).forEach(function (el) {
      el.style.visibility = '';
      if (!api.enabled || !window.SplitText || el._lineReveal) return;
      el._lineReveal = true;
      var type = o.type || el.getAttribute('data-reveal') || 'lines';
      if (type !== 'words') type = 'lines';
      var played = false;
      // Nom accessible: aria 'auto' amaga els trossos i posa al títol un aria-label fet amb
      // textContent, que perd els <br> i enganxa paraules («Un cafèa peu de pista.»). Es calcula
      // abans de dividir amb els <br> com a espais i es torna a posar a cada divisió.
      // ('hidden' no serveix: amaga el títol sencer als lectors de pantalla.)
      var label = el.getAttribute('aria-label');
      if (!label) {
        var copy = el.cloneNode(true);
        Array.prototype.forEach.call(copy.querySelectorAll('br'), function (br) { br.replaceWith(' '); });
        label = copy.textContent.replace(/\s+/g, ' ').trim();
      }
      window.SplitText.create(el, {
        type: type === 'words' ? 'lines,words' : 'lines',
        mask: 'lines',
        linesClass: 'line',
        autoSplit: true,
        aria: 'auto',
        onSplit: function (self) {
          el.setAttribute('aria-label', label);
          if (played) return;
          var parts = type === 'words' ? self.words : self.lines;
          var vars = {
            yPercent: 118,
            duration: o.duration || 1,
            ease: EASE.out,
            stagger: o.stagger != null ? o.stagger : (type === 'words' ? 0.06 : 0.09),
            delay: o.delay || 0,
            onComplete: function () { played = true; }
          };
          if (!o.load) vars.scrollTrigger = { trigger: el, start: o.start || 'top 88%', once: true };
          return gsap.from(parts, vars);
        }
      });
    });
  };

  /* ---------- Entrades suaus de blocs ---------- */
  api.fadeUp = function (targets, o) {
    o = o || {};
    var els = toArray(targets);
    els.forEach(function (el) { el.style.visibility = ''; });
    if (!api.enabled || !els.length) return;
    // Només opacitat (no autoAlpha): el bloc continua a l'arbre d'accessibilitat i rep
    // focus abans d'entrar en pantalla; el focus el fa visible en desplaçar-hi la pàgina.
    gsap.set(els, { y: o.y != null ? o.y : 24, opacity: 0 });
    window.ScrollTrigger.batch(els, {
      start: o.start || 'top 90%',
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, { y: 0, opacity: 1, duration: o.duration || 0.8, ease: EASE.out, stagger: { each: o.stagger || 0.06, amount: Math.min(0.5, (o.stagger || 0.06) * batch.length) }, overwrite: true, clearProps: 'transform' });
      }
    });
  };

  /* ---------- Filets que es dibuixen ---------- */
  api.draw = function (targets, o) {
    o = o || {};
    var els = toArray(targets);
    if (!api.enabled || !els.length) return;
    els.forEach(function (el) {
      gsap.fromTo(el, { scaleX: 0, transformOrigin: o.origin || 'left center' }, {
        scaleX: 1, duration: o.duration || 1.1, ease: EASE.out, delay: o.delay || 0,
        scrollTrigger: o.load ? undefined : { trigger: o.trigger || el, start: o.start || 'top 92%', once: true }
      });
    });
  };

  /* ---------- Comptadors ---------- */
  api.countUp = function (el, value, o) {
    o = o || {};
    if (!el) return;
    if (!Number.isFinite(value)) { el.textContent = o.pending || 'Pendent'; return; }
    var decimals = o.decimals != null ? o.decimals : decimalsOf(value);
    var fmt = o.format || function (n) { return formatter(decimals).format(n); };
    var suffix = o.suffix || '';
    var finalText = fmt(value) + suffix;
    el.textContent = finalText;
    if (!api.enabled) return;
    el.setAttribute('data-count-ready', '');
    var width = Math.ceil(el.getBoundingClientRect().width);
    el.style.minWidth = width + 'px';
    var sr = document.createElement('span');
    sr.className = 'line-sr';
    sr.textContent = finalText;
    var shown = document.createElement('span');
    shown.setAttribute('aria-hidden', 'true');
    el.replaceChildren(sr, shown);
    var state = { v: o.from || 0 };
    var paint = function () {
      var n = decimals ? state.v : Math.round(state.v);
      shown.textContent = fmt(n) + suffix;
    };
    paint();
    gsap.to(state, {
      v: value, duration: o.duration || 1.6, ease: EASE.out, delay: o.delay || 0,
      onUpdate: paint,
      onComplete: function () { shown.textContent = finalText; },
      scrollTrigger: o.load ? undefined : { trigger: o.trigger || el, start: o.start || 'top 85%', once: true }
    });
  };

  /* ---------- Punter: magnètic ---------- */
  api.magnetic = function (targets, o) {
    o = o || {};
    if (!api.fine) return;
    toArray(targets).forEach(function (el) {
      var strength = o.strength != null ? o.strength : 0.3;
      var radius = o.radius != null ? o.radius : 80;
      var qx = gsap.quickTo(el, 'x', { duration: 0.6, ease: EASE.soft });
      var qy = gsap.quickTo(el, 'y', { duration: 0.6, ease: EASE.soft });
      var px = 0, py = 0, raf = 0, active = false;
      function update() {
        raf = 0;
        var b = el.getBoundingClientRect();
        var cx = b.left + b.width / 2 - (gsap.getProperty(el, 'x') || 0);
        var cy = b.top + b.height / 2 - (gsap.getProperty(el, 'y') || 0);
        var dx = px - cx, dy = py - cy;
        var reach = Math.max(b.width, b.height) / 2 + radius;
        if (Math.hypot(dx, dy) < reach) { qx(dx * strength); qy(dy * strength); active = true; }
        else if (active) { qx(0); qy(0); active = false; }
      }
      function move(e) { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(update); }
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) window.addEventListener('pointermove', move, { passive: true });
        else { window.removeEventListener('pointermove', move); if (active) { qx(0); qy(0); active = false; } }
      }).observe(el);
    });
  };

  /* ---------- Punter: posició normalitzada amb inèrcia ---------- */
  // cb(nx, ny) rep valors de -1 a 1 suavitzats; torna a 0 en sortir.
  api.pointer = function (el, cb, o) {
    o = o || {};
    if (!api.fine || !el) return;
    var state = { x: 0, y: 0 };
    var tx = gsap.quickTo(state, 'x', { duration: o.duration || 0.9, ease: EASE.soft, onUpdate: function () { cb(state.x, state.y); } });
    var ty = gsap.quickTo(state, 'y', { duration: o.duration || 0.9, ease: EASE.soft, onUpdate: function () { cb(state.x, state.y); } });
    el.addEventListener('pointermove', function (e) {
      var b = el.getBoundingClientRect();
      tx(((e.clientX - b.left) / b.width) * 2 - 1);
      ty(((e.clientY - b.top) / b.height) * 2 - 1);
    }, { passive: true });
    el.addEventListener('pointerleave', function () { tx(0); ty(0); });
  };

  /* ---------- Punter: etiqueta contextual ---------- */
  var cursor = null, cqx, cqy, cursorOn = false, lastX = -200, lastY = -200;
  function ensureCursor() {
    if (cursor) return;
    cursor = document.createElement('div');
    cursor.className = 'line-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cursor);
    gsap.set(cursor, { x: -200, y: -200, scale: 0.6, autoAlpha: 0 });
    cqx = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: EASE.soft });
    cqy = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: EASE.soft });
    window.addEventListener('pointermove', function (e) {
      lastX = e.clientX + 18; lastY = e.clientY + 18;
      if (cursorOn) { cqx(lastX); cqy(lastY); }
    }, { passive: true });
    document.addEventListener('pointerdown', function () { if (cursorOn) gsap.to(cursor, { scale: 0.9, duration: 0.12, yoyo: true, repeat: 1 }); });
  }
  api.cursorLabel = function (targets, text) {
    if (!api.fine) return;
    ensureCursor();
    toArray(targets).forEach(function (el) {
      var label = function (e) { return typeof text === 'function' ? text(e, el) : text; };
      el.addEventListener('pointerenter', function (e) {
        if (e.pointerType !== 'mouse') return;
        var t = label(e);
        if (!t) return;
        cursor.textContent = t;
        if (!cursorOn) gsap.set(cursor, { x: e.clientX + 18, y: e.clientY + 18 });
        cursorOn = true;
        gsap.to(cursor, { autoAlpha: 1, scale: 1, duration: DUR.d2, ease: EASE.soft, overwrite: 'auto' });
      });
      if (typeof text === 'function') {
        el.addEventListener('pointermove', function (e) {
          if (!cursorOn) return;
          var t = label(e);
          if (!t) { gsap.to(cursor, { autoAlpha: 0, scale: 0.6, duration: DUR.d2 * 0.75 }); return; }
          if (cursor.textContent !== t) cursor.textContent = t;
          gsap.to(cursor, { autoAlpha: 1, scale: 1, duration: DUR.d2, overwrite: 'auto' });
        }, { passive: true });
      }
      el.addEventListener('pointerleave', function () {
        cursorOn = false;
        gsap.to(cursor, { autoAlpha: 0, scale: 0.6, duration: DUR.d2 * 0.75, ease: EASE.soft, overwrite: 'auto' });
      });
    });
  };

  /* ---------- Línia de progrés ---------- */
  api.progress = function (el) {
    if (!api.enabled || !el) return;
    gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
  };

  /* ---------- Navegació: scrollspy amb indicador lliscant ---------- */
  api.navSpy = function (nav, o) {
    o = o || {};
    if (!nav || !window.ScrollTrigger) return null;
    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]')).filter(function (a) {
      return !a.hidden && a.hash.length > 1 && document.getElementById(a.hash.slice(1));
    });
    var ink = null, current = null;
    if (api.enabled) {
      ink = document.createElement('span');
      ink.className = 'nav-ink';
      ink.setAttribute('aria-hidden', 'true');
      if (getComputedStyle(nav).position === 'static') nav.style.position = 'relative';
      nav.appendChild(ink);
    }
    function moveInk(link, instant) {
      if (!ink) return;
      if (!link) { gsap.to(ink, { autoAlpha: 0, duration: DUR.d2 }); return; }
      var vars = { x: link.offsetLeft, width: link.offsetWidth, autoAlpha: 1, duration: instant ? 0 : DUR.d3, ease: EASE.out, overwrite: 'auto' };
      gsap.to(ink, vars);
    }
    function setActive(link) {
      current = link;
      links.forEach(function (l) {
        if (l === link) l.setAttribute('aria-current', 'location');
        else l.removeAttribute('aria-current');
      });
      moveInk(link);
    }
    // Enllaç actiu: el de la darrera secció activa en ordre de pàgina. Al final de la pàgina
    // sempre el darrer, perquè si la darrera secció comença a menys de mitja pantalla del final,
    // el seu «top center» queda més enllà del desplaçament màxim i no s’activaria mai.
    var triggers = [], atEnd = false;
    function pick() {
      var link = null;
      if (atEnd && links.length) link = links[links.length - 1];
      else for (var i = triggers.length - 1; i >= 0; i--) if (triggers[i].isActive) { link = links[i]; break; }
      if (link !== current) setActive(link);
    }
    links.forEach(function (link) {
      var section = document.getElementById(link.hash.slice(1));
      triggers.push(window.ScrollTrigger.create({
        trigger: section,
        start: o.start || 'top center',
        end: o.end || 'bottom center',
        onToggle: pick
      }));
      if (ink) {
        link.addEventListener('pointerenter', function () { moveInk(link); });
      }
    });
    if (links.length) {
      var endCheck = function (self) {
        var on = self.progress > 0.5;
        if (on !== atEnd) { atEnd = on; pick(); }
      };
      window.ScrollTrigger.create({
        start: function () { return Math.max(0, window.ScrollTrigger.maxScroll(window) - 2); },
        end: 'max',
        refreshPriority: -1,   // després dels pins, que encara afegeixen alçada a la pàgina
        onUpdate: endCheck,
        onRefresh: endCheck
      });
      // ScrollTrigger no crida onToggle durant un refresh (ni en crear cada disparador, quan
      // encara no és a la llista): es torna a triar en acabar.
      window.ScrollTrigger.addEventListener('refresh', pick);
      pick();
    }
    if (ink) {
      nav.addEventListener('pointerleave', function () { moveInk(current); });
      window.ScrollTrigger.addEventListener('refresh', function () { if (current) moveInk(current, true); });
    }
    return { setActive: setActive, links: links };
  };

  /* ---------- Posició inicial ---------- */
  // Els pins de les pàgines afegeixen alçada quan ja s’han creat. El salt a l’àncora en una
  // càrrega amb #hash (Chromium) i la restauració en recarregar (tots dos motors) s’apliquen
  // abans i deixen la pàgina curta, sovint a mig pin. La restauració passa a ser manual: es
  // desa la posició en sortir i es torna a aplicar quan els scripts de pàgina ja han creat els pins.
  var STORE = 'line-scroll:' + location.pathname;
  function navType() {
    try { var n = performance.getEntriesByType('navigation')[0]; if (n) return n.type; } catch (e) { /* res */ }
    return 'navigate';
  }
  function jumpTo(y) {
    if (api.lenis) {
      // Lenis encara té el límit d’abans dels pins (l’actualitza amb un ResizeObserver).
      if (typeof api.lenis.resize === 'function') api.lenis.resize();
      api.lenis.scrollTo(y, { immediate: true, force: true });
    } else window.scrollTo(0, y);
    window.ScrollTrigger.update();
  }
  function keepPosition() {
    var type = navType();
    var saved = null;
    try {
      history.scrollRestoration = 'manual';
      saved = sessionStorage.getItem(STORE);
      sessionStorage.removeItem(STORE);
    } catch (e) { /* sense emmagatzematge: com sempre */ }
    window.addEventListener('pagehide', function () {
      try { sessionStorage.setItem(STORE, String(Math.round(window.scrollY))); } catch (e) { /* res */ }
    });
    // Recàrrega o enrere/endavant: la posició desada. Càrrega nova amb #hash: l’àncora.
    var target = null;
    if (type !== 'navigate' && saved != null && isFinite(+saved)) target = +saved;
    else if (location.hash.length > 1) {
      try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) { target = null; }
    }
    if (target == null) return;
    var applied = null;
    var apply = function () {
      var y = typeof target === 'number' ? Math.min(target, window.ScrollTrigger.maxScroll(window)) : targetY(target);
      jumpTo(y);
      applied = Math.round(window.scrollY);
    };
    // Després dels scripts de pàgina (que corren en microtasques de ready) i del seu refresh.
    setTimeout(function () {
      apply();
      // Si la càrrega encara no ha acabat, el refresh de load pot moure els pins: es repeteix,
      // només si l’usuari no s’ha mogut mentrestant.
      if (document.readyState !== 'complete') {
        window.addEventListener('load', function () {
          setTimeout(function () { if (applied != null && Math.abs(window.scrollY - applied) < 2) apply(); }, 0);
        }, { once: true });
      }
    }, 0);
  }

  /* ---------- Drecera ---------- */
  api.onReady = function (fn) { return api.ready.then(function (m) { try { fn(m); } catch (e) { console.error('[LINE.motion]', e); } return m; }); };

  /* ---------- Arrencada ---------- */
  api.ready = (async function () {
    await domReady;
    var ok = await ensureLibs();
    if (!ok) {
      root.classList.remove('motion-ok');
      clearTimeout(failsafe); markReady();
      wireAnchors();
      return api;
    }
    var plugins = [window.ScrollTrigger];
    if (window.SplitText) plugins.push(window.SplitText);
    gsap.registerPlugin.apply(gsap, plugins);
    try { await Promise.race([document.fonts.ready, wait(1500)]); } catch (e) { /* res */ }

    api.enabled = !reduceQ.matches;
    api.fine = api.enabled && fineQ.matches;
    if (!api.enabled) root.classList.remove('motion-ok');

    if (api.enabled && window.Lenis) {
      var lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, anchors: false });
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
      lenis.on('scroll', window.ScrollTrigger.update);
      api.lenis = lenis;
    }
    wireAnchors();

    // Revelacions declaratives
    api.reveal('[data-reveal]');
    api.fadeUp('[data-reveal-up]');
    api.draw('[data-draw]');
    api.magnetic('[data-magnetic]');
    toArray('[data-cursor]').forEach(function (el) { api.cursorLabel(el, el.getAttribute('data-cursor')); });
    toArray('[data-progress]').forEach(api.progress);

    window.addEventListener('load', function () { window.ScrollTrigger.refresh(); }, { once: true });
    reduceQ.addEventListener && reduceQ.addEventListener('change', function () { location.reload(); });
    keepPosition();

    clearTimeout(failsafe); markReady();
    return api;
  })();
})();
