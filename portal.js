/* Portal · moviment i avançament de dades.
 * Depèn de comu/motion.js (window.LINE.motion) i de les dades globals
 * window.EDICIO_NESCAFE / window.EDICIO_CONTINENTAL (edicio.js de cada carpeta).
 * Sense moviment o sense biblioteques, la pàgina queda estàtica i completa. */
(function () {
  'use strict';

  var root = document.documentElement;
  var motion = window.LINE && window.LINE.motion;

  var fmtCache = {};
  function fmt(value) {
    if (motion) return motion.format(value, 0);
    if (!fmtCache.f) fmtCache.f = new Intl.NumberFormat('ca-ES', { useGrouping: 'always', maximumFractionDigits: 0 });
    return fmtCache.f.format(value);
  }
  function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }

  /* ---------- Avançament de dades: text estàtic, sempre al DOM ---------- */
  function teaserItems(id) {
    if (id === 'kpi-nes') {
      var n = window.EDICIO_NESCAFE, s = n && n.sorteig;
      if (!s) return null;
      return [[num(s.participacions), 'participacions'], [num(s.paginesVistes), 'pàgines vistes']];
    }
    var c = window.EDICIO_CONTINENTAL, list = c && c.periodes;
    var last = list && list.length ? list[list.length - 1] : null;
    if (!last) return null;
    return [
      [num(last.visites && last.visites.temporada), 'visites de temporada'],
      [num(last.obertura && last.obertura.temporada), 'dies oberts']
    ];
  }

  var teasers = [];
  Array.prototype.forEach.call(document.querySelectorAll('.kpi'), function (p) {
    var items = teaserItems(p.id);
    var inner = p.querySelector('.kpi-in');
    if (!items || !inner) return;
    var nums = [];
    items.forEach(function (item, i) {
      if (i) inner.appendChild(document.createTextNode(' · '));
      var n = document.createElement('span');
      n.className = 'kpi-n';
      if (item[0] == null) {
        // Magnitud pendent: etiqueta primer, estat després ("visites de temporada: pendent").
        n.textContent = 'pendent';
        inner.appendChild(document.createTextNode(item[1] + ': '));
        inner.appendChild(n);
        return;
      }
      n.textContent = fmt(item[0]);
      inner.appendChild(n);
      inner.appendChild(document.createTextNode(' ' + item[1]));
      nums.push({ el: n, value: item[0] });
    });
    p.hidden = false;
    teasers.push({ panel: p.closest('.panel'), nums: nums });
  });

  function countTeaser(panel, delay) {
    if (!motion) return;
    teasers.forEach(function (t) {
      if (t.panel !== panel) return;
      t.nums.forEach(function (n, i) {
        if (n.value == null) return;
        motion.countUp(n.el, n.value, { load: true, decimals: 0, duration: 1.1, delay: (delay || 0) + i * 0.08 });
      });
    });
  }

  if (!motion) return;

  motion.onReady(function (m) {
    if (!m.enabled || !window.gsap) return;
    var gsap = window.gsap;
    root.classList.add('portal-motion');
    if (m.fine) root.classList.add('portal-lens');

    var h1 = document.querySelector('.heading h1');
    var panels = gsap.utils.toArray('.panel');
    var arts = panels.map(function (p) { return p.querySelector('.art'); });
    var strips = panels.map(function (p) { return p.querySelector('.strip'); });
    var hairlines = gsap.utils.toArray('.site-head, .foot, .sources');

    /* ---------- Coreografia d'entrada (no depèn del scroll) ---------- */
    m.reveal(h1, { type: 'words', load: true, duration: m.dur.d4, stagger: 0.06 });

    var at = 0.28; // les targetes entren quan el títol ja és a mig camí
    var tl = gsap.timeline({ defaults: { ease: m.ease.out } });
    tl.fromTo(hairlines, { borderBottomColor: 'rgba(133,136,129,0)' },
      { borderBottomColor: 'rgba(133,136,129,1)', duration: m.dur.d4, ease: m.ease.soft, stagger: 0.06, clearProps: 'borderBottomColor' }, 0)
      .fromTo(panels, { clipPath: 'inset(100% 0% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.95, ease: m.ease.io, stagger: 0.12, clearProps: 'clipPath' }, at)
      .fromTo(arts, { scale: 1.08 }, { scale: 1, duration: 1.6, stagger: 0.12 }, at)
      .fromTo(strips, { scaleX: 0 }, { scaleX: 1, duration: 0.9, stagger: 0.12, clearProps: 'transform' }, at + 0.7);

    // Sense hover (pantalla tàctil), l'avançament ja és visible: compta un cop a l'entrada.
    if (!m.fine) panels.forEach(function (p, i) { countTeaser(p, at + 0.8 + i * 0.12); });

    /* ---------- Lent de punter, zoom i avançament per targeta ---------- */
    panels.forEach(function (panel, i) {
      var art = arts[i];
      var logo = panel.querySelector('.logotype');
      var open = false, hover = false, focus = false;

      function zoom(on) {
        gsap.to(art, { scale: on ? 1.06 : 1, duration: on ? m.dur.d4 : m.dur.d4 * 0.75, ease: m.ease.out, overwrite: 'auto' });
      }
      function sync() {
        var next = hover || focus;
        if (next === open) return;
        open = next;
        zoom(open);
        if (open && m.fine) countTeaser(panel, 0.06);
      }

      panel.addEventListener('focus', function () { focus = panel.matches(':focus-visible'); sync(); });
      panel.addEventListener('blur', function () { focus = false; sync(); });

      if (!m.fine) return;

      panel.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { hover = true; sync(); } });
      panel.addEventListener('pointerleave', function () { hover = false; sync(); });

      var artX = gsap.quickSetter(art, 'x', 'px'), artY = gsap.quickSetter(art, 'y', 'px');
      var logoX = logo ? gsap.quickSetter(logo, 'x', 'px') : null, logoY = logo ? gsap.quickSetter(logo, 'y', 'px') : null;
      m.pointer(panel, function (nx, ny) {
        artX(nx * -12); artY(ny * -12);
        if (logoX) { logoX(nx * 3); logoY(ny * 3); }
        panel.style.setProperty('--mx', ((nx + 1) * 50).toFixed(2) + '%');
        panel.style.setProperty('--my', ((ny + 1) * 50).toFixed(2) + '%');
      }, { duration: 0.8 });
    });

    /* ---------- Fletxa magnètica (limitada a la seva targeta) i etiqueta del cursor ---------- */
    // 2 elements: el màxim per pantalla. El desplaçament queda dins de ±12 px
    // perquè la fletxa no surti del padding mínim de la targeta.
    m.cursorLabel(panels, 'Obrir l’informe');
    var label = document.querySelector('.line-cursor');
    var LABEL_OFFSET = 18; // desplaçament de l'etiqueta respecte del punter (comu/motion.js)
    var inZone = false;
    // L'etiqueta es replega (portal.css) mentre la seva posició de destinació
    // trepitjaria la fletxa. Marge amb histèresi per evitar parpelleig a la vora.
    function setZone(on) {
      if (on === inZone) return;
      inZone = on;
      root.classList.toggle('portal-arrow-zone', on);
    }
    if (m.fine) panels.forEach(function (panel) {
      var arrow = panel.querySelector('.arrow');
      if (!arrow) return;
      var qx = gsap.quickTo(arrow, 'x', { duration: 0.6, ease: m.ease.soft });
      var qy = gsap.quickTo(arrow, 'y', { duration: 0.6, ease: m.ease.soft });
      var clamp = gsap.utils.clamp(-12, 12);
      var px = 0, py = 0, raf = 0;
      function update() {
        raf = 0;
        var b = arrow.getBoundingClientRect();
        var cx = b.left + b.width / 2 - (gsap.getProperty(arrow, 'x') || 0);
        var cy = b.top + b.height / 2 - (gsap.getProperty(arrow, 'y') || 0);
        var tx = clamp((px - cx) * 0.3), ty = clamp((py - cy) * 0.3);
        qx(tx); qy(ty);
        if (!label) return;
        // Rectangles de destinació: fletxa (repòs + desplaçament) i etiqueta (punter + 18 px).
        var pad = inZone ? 16 : 8;
        var ax = cx + tx - b.width / 2, ay = cy + ty - b.height / 2;
        var lx = px + LABEL_OFFSET, ly = py + LABEL_OFFSET;
        setZone(lx < ax + b.width + pad && lx + label.offsetWidth > ax - pad &&
                ly < ay + b.height + pad && ly + label.offsetHeight > ay - pad);
      }
      panel.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        px = e.clientX; py = e.clientY;
        if (!raf) raf = requestAnimationFrame(update);
      }, { passive: true });
      panel.addEventListener('pointerleave', function () {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        qx(0); qy(0);
        setZone(false);
      });
    });

    /* ---------- Sortida: la targeta s'expandeix fins a omplir la finestra ----------
       Només el clic principal sense modificadors. Cmd/Ctrl/Maj/Alt, el botó del mig i
       l'activació per teclat (Enter genera un click amb detail 0) naveguen de manera
       nativa i immediata, sense animació ni pèrdua de focus.
       Una còpia fixa de la imatge (mateix fitxer ja descodificat, sense srcset) creix
       des del rectangle de la targeta fins a la finestra; la targeta original no es
       mou: només s'amaguen els seus mitjans i el text s'esvaeix al seu lloc. */
    var pages = document.querySelector('.pages');
    var pageChrome = gsap.utils.toArray('.site-head, .heading, .site-foot');
    var EXIT_GROW = 0.48, EXIT_LEAD = 0.04, EXIT_FAILSAFE = 900;
    var exitState = null;

    function px(n) { return n.toFixed(2) + 'px'; }

    // Retorn a repòs de les targetes després de la sortida. La targeta clicada queda
    // per sobre de la còpia i no rep mai pointerleave: un leave sintètic fa córrer tots
    // els oients (lent i desplaçaments a 0, etiqueta del cursor, zoom, fletxa), i el
    // primer moviment del ratolí sobre una targeta torna a entrar-hi (entrades dobles
    // són inofensives: sync() no fa res si l'estat no canvia).
    function resyncPointer() {
      if (!m.fine || typeof window.PointerEvent !== 'function') return;
      panels.forEach(function (panel) {
        panel.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
        panel.addEventListener('pointermove', function (e) {
          if (e.pointerType !== 'mouse') return;
          panel.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', clientX: e.clientX, clientY: e.clientY }));
        }, { once: true, passive: true });
      });
      // L'etiqueta s'amaga a l'instant: sense l'esvaïment del leave a l'última posició.
      if (label) gsap.set(label, { autoAlpha: 0, scale: 0.6, overwrite: 'auto' });
    }

    function resetExit() {
      var s = exitState;
      if (!s) return;
      exitState = null;
      clearTimeout(s.failsafe);
      if (s.tl) s.tl.kill();
      if (s.overlay && s.overlay.parentNode) s.overlay.parentNode.removeChild(s.overlay);
      if (s.faded.length) gsap.set(s.faded, { clearProps: 'opacity' });
      s.panel.classList.remove('is-exiting', 'kpi-held');
      root.classList.remove('portal-exiting');
      if (pages) { pages.style.gridTemplateColumns = ''; pages.style.transition = ''; }
      // L'entrada es va aturar en clicar (build): acaba-la neta.
      if (tl.progress() < 1) tl.progress(1);
      resyncPointer();
      setZone(false);
    }

    function startExit(panel) {
      var href = panel.href;
      var s = exitState = { panel: panel, tl: null, overlay: null, faded: [], built: false, gone: false, failsafe: 0 };
      function go() {
        if (s.gone) return;
        s.gone = true;
        clearTimeout(s.failsafe);
        location.href = href;
        // Navegació avortada (Esc / Atura abans que la pàgina nova es confirmi): el
        // portal torna a ser operatiu. Si el document es descarrega no s'executa mai; si
        // entra al bfcache, pageshow ja l'haurà restablert i la guarda el deixa inert.
        setTimeout(function () { if (exitState === s) resetExit(); }, 3000);
      }
      s.failsafe = setTimeout(go, EXIT_FAILSAFE);

      var art = panel.querySelector('.art');
      if (!art) { go(); return; }
      var img = document.createElement('img');
      img.className = 'portal-exit-art';
      img.alt = '';
      img.decoding = 'sync';
      img.src = art.currentSrc || art.src;

      function build() {
        if (exitState !== s || s.built) return;
        s.built = true;
        try {
          // L'entrada (si encara corre) es congela on és: saltar al final faria esclatar
          // el retall de l'altra targeta i les franges. La mesura no en depèn
          // (getBoundingClientRect ignora clip-path i ja inclou l'escala de la imatge).
          tl.pause();
          // Atura la inèrcia de Lenis perquè la targeta no es desplaci sota la còpia fixa.
          if (m.lenis && typeof m.lenis.animatedScroll === 'number') m.lenis.scrollTo(m.lenis.animatedScroll, { immediate: true, force: true });

          /* Lectures */
          var pr = panel.getBoundingClientRect();
          var ar = art.getBoundingClientRect(); // inclou l'escala i el desplaçament de la lent
          var vw = root.clientWidth, vh = root.clientHeight;
          var cs = getComputedStyle(panel);
          var objectPosition = getComputedStyle(art).objectPosition;
          var cols = pages ? getComputedStyle(pages).gridTemplateColumns : '';
          var lit = m.fine && panel.matches(':hover');
          // Només es manté obert l'avançament que ja ho era (un toc no l'obre a mitja sortida).
          var held = panel.matches(':hover, :focus-visible');
          // Retall vertical d'entrada encara en curs (només anima el marge superior).
          var clipMatch = /inset\(\s*([\d.]+)%/.exec(panel.style.clipPath || '');
          var clipTop = clipMatch ? parseFloat(clipMatch[1]) : 0;
          var panelStrip = panel.querySelector('.strip');
          var stripScale = panelStrip ? Number(gsap.getProperty(panelStrip, 'scaleX')) : 1;
          if (!(stripScale >= 0 && stripScale < 1)) stripScale = 1;

          /* Còpia: marc + imatge + ombra + franja */
          var overlay = s.overlay = document.createElement('div');
          overlay.className = 'portal-exit';
          overlay.setAttribute('aria-hidden', 'true');
          var frame = document.createElement('div');
          frame.className = 'portal-exit-frame' + (lit ? ' is-lit' : '');
          frame.style.left = px(pr.left); frame.style.top = px(pr.top);
          frame.style.width = px(pr.width); frame.style.height = px(pr.height);
          frame.style.setProperty('--card-accent', cs.getPropertyValue('--card-accent').trim() || '#161815');
          frame.style.setProperty('--mx', panel.style.getPropertyValue('--mx') || '50%');
          frame.style.setProperty('--my', panel.style.getPropertyValue('--my') || '50%');
          img.style.left = px(ar.left - pr.left); img.style.top = px(ar.top - pr.top);
          img.style.width = px(ar.width); img.style.height = px(ar.height);
          img.style.objectPosition = objectPosition;
          var shade = document.createElement('span');
          shade.className = 'shade';
          var strip = document.createElement('i');
          strip.className = 'strip';
          frame.appendChild(img); frame.appendChild(shade); frame.appendChild(strip);
          overlay.appendChild(frame);
          var clipFrom = 'inset(' + clipTop.toFixed(3) + '% 0% 0% 0%)';
          if (clipTop > 0) frame.style.clipPath = clipFrom;
          if (stripScale < 1) gsap.set(strip, { scaleX: stripScale });

          /* Escriptures, totes en el mateix frame: cap estat intermedi visible */
          if (pages) { pages.style.transition = 'none'; pages.style.gridTemplateColumns = cols; }
          document.body.appendChild(overlay);
          if (held) panel.classList.add('kpi-held');
          panel.classList.add('is-exiting');
          root.classList.add('portal-exiting');

          var others = panels.filter(function (p) { return p !== panel; });
          var inner = [panel.querySelector('.logotype'), panel.querySelector(':scope > div')].filter(Boolean);
          s.faded = pageChrome.concat(others, inner);
          var grow = { left: 0, top: 0, width: vw, height: vh, duration: EXIT_GROW, ease: m.ease.io };

          s.tl = gsap.timeline({ onComplete: go })
            .to(others, { opacity: 0, duration: 0.18, ease: 'power2.out' }, 0)
            .to(inner, { opacity: 0, duration: 0.2, ease: m.ease.soft }, 0)
            .to(pageChrome, { opacity: 0, duration: 0.3, ease: m.ease.soft }, 0)
            .to(frame, grow, EXIT_LEAD)
            .to(img, grow, EXIT_LEAD)
            .to(shade, { opacity: 0, duration: EXIT_GROW, ease: m.ease.soft }, EXIT_LEAD);
          // L'entrada interrompuda acaba dins de la còpia, sense salt.
          if (clipTop > 0) s.tl.fromTo(frame, { clipPath: clipFrom },
            { clipPath: 'inset(0% 0% 0% 0%)', duration: EXIT_GROW * 0.6, ease: m.ease.out, immediateRender: false }, EXIT_LEAD);
          if (stripScale < 1) s.tl.to(strip, { scaleX: 1, duration: EXIT_GROW * 0.6, ease: m.ease.out }, EXIT_LEAD);
        } catch (err) {
          go();
        }
      }

      // La imatge ja és a la memòria de la pàgina: normalment està llesta a l'instant.
      if (img.complete && img.naturalWidth) build();
      else {
        if (img.decode) img.decode().then(build, build);
        else img.addEventListener('load', build, { once: true });
        setTimeout(build, 140);
      }
    }

    panels.forEach(function (panel) {
      panel.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (exitState) { e.preventDefault(); return; } // ja està sortint
        if (e.detail === 0) return; // teclat o tecnologia d'assistència: navegació nativa
        e.preventDefault();
        startExit(panel);
      });
    });

    // Tornada amb el botó Enrere (bfcache): el portal ha de quedar operatiu.
    window.addEventListener('pageshow', function (e) { if (e.persisted) resetExit(); });
  });
})();
