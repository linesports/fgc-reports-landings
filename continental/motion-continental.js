/* Continental × LINE · moviment de pàgina (fases 1–3)
 * Depèn de ../comu/motion.js (window.LINE.motion). S’executa després de report.js,
 * quan el text de l’edició ja és al DOM. Els títols de secció porten data-reveal
 * i motion.js els connecta sol; aquí hi ha la portada, la capçalera i les entrades.
 */
(function () {
  'use strict';

  function one(sel) { return document.querySelector(sel); }
  function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  // Reserva si no hi ha ScrollTrigger: scrollspy mínim amb IntersectionObserver.
  function fallbackSpy() {
    if (!('IntersectionObserver' in window)) return;
    var links = all('.mast nav a');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (link) {
          if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-8% 0px -45% 0px' });
    ['dades', 'territori', 'activacions'].forEach(function (id) {
      var section = document.getElementById(id);
      if (section) io.observe(section);
    });
  }

  if (!window.LINE || !window.LINE.motion) { fallbackSpy(); return; }

  window.LINE.motion.onReady(function (m) {
    var gsap = window.gsap;
    var ST = window.ScrollTrigger;
    var header = one('.top');
    var hero = one('.hero');

    /* ---------- Navegació i capçalera ---------- */
    if (!m.navSpy(one('.mast nav'))) fallbackSpy();

    // Capçalera compacta un cop la portada ha sortit (funciona també amb moviment reduït).
    if (ST && header && hero) {
      var setCompact = function (on) { header.classList.toggle('is-compact', on); };
      var compact = ST.create({
        trigger: hero,
        start: 'bottom top',
        onEnter: function () { setCompact(true); },
        onLeaveBack: function () { setCompact(false); },
        onRefresh: function (self) { setCompact(self.scroll() > self.start); }
      });
      setCompact(compact.scroll() > compact.start);
    }

    if (!m.enabled) {
      countKpis(m);
      return;
    }

    /* ---------- Portada: entrada ---------- */
    var img = one('.hero-img');
    var title = one('#page-title');
    var head = one('.hero-head');
    var editionLine = one('#edicio');
    var roundlink = one('.roundlink');
    var fade = one('.hero-fade');
    // Amb punter fi la imatge es desplaça ±6 px; una escala mínima evita veure’n les vores.
    var restScale = m.fine ? 1.02 : 1;

    if (img) {
      gsap.fromTo(img,
        { clipPath: 'inset(14% 12% 14% 12%)', scale: 1.08, autoAlpha: 0 },
        { clipPath: 'inset(0% 0% 0% 0%)', scale: restScale, autoAlpha: 1, duration: 1.6, ease: m.ease.out, clearProps: 'clipPath' });
    }
    if (title) {
      m.reveal(title, { load: true, delay: 0.35 });
      // El punt groc apareix després de la paraula, sense rebot.
      var dot = title.querySelector('span:not([class])');
      if (dot) gsap.fromTo(dot, { scale: 0 }, { scale: 1, duration: 0.7, delay: 1.05, ease: m.ease.soft, transformOrigin: '50% 80%' });
    }
    var quiet = [head, editionLine].filter(Boolean);
    if (quiet.length) gsap.from(quiet, { autoAlpha: 0, y: 10, duration: 1, delay: 0.5, stagger: 0.08, ease: m.ease.out });
    // Només opacitat: x/y del botó els gestiona l’efecte magnètic.
    if (roundlink) gsap.from(roundlink, { autoAlpha: 0, duration: 0.8, delay: 0.95, ease: m.ease.soft });

    /* ---------- Portada: scroll ---------- */
    if (hero) {
      var leave = { trigger: hero, start: 0, end: 'bottom top', scrub: true };
      if (img) gsap.to(img, { yPercent: 12, ease: 'none', scrollTrigger: leave });
      if (title) gsap.to(title, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: hero, start: 0, end: 'bottom top', scrub: true } });
      if (fade) {
        gsap.set(fade, { '--dim': 0 });
        gsap.to(fade, { '--dim': 0.55, ease: 'none', scrollTrigger: { trigger: hero, start: 0, end: 'bottom top', scrub: true } });
      }
    }

    /* ---------- Portada: punter ---------- */
    if (m.fine && hero && img) {
      var setX = gsap.quickSetter(img, 'x', 'px');
      var setY = gsap.quickSetter(img, 'y', 'px');
      m.pointer(hero, function (nx, ny) { setX(-nx * 6); setY(-ny * 6); });
    }
    if (roundlink) m.magnetic(roundlink, { strength: 0.3, radius: 60 });

    /* ---------- Dades ---------- */
    m.fadeUp('#kpis .kpi-cut, #kpis .kpi', { y: 18, stagger: 0.08 });
    countKpis(m);
    m.fadeUp('#facts tbody tr', { y: 12, stagger: 0.05 });

    /* ---------- Relleu i activacions ---------- */
    // Només opacitat (sense visibility): el panell conté el canvas i els botons del relleu, que han de ser focusables.
    var panel = one('.terrain-panel');
    if (panel) {
      var panelIn = gsap.from(panel, { opacity: 0, y: 32, duration: 0.8, ease: m.ease.out, scrollTrigger: { trigger: panel, start: 'top 90%', once: true } });
      panel.addEventListener('focusin', function () { panelIn.progress(1); }, { once: true });
    }
    m.fadeUp('.pending-block', { y: 24 });

    /* ---------- Relleu: vol d’entrada (fase 2) ---------- */
    if (ST) terrainFlight(m, gsap, ST);

    /* ---------- Fons de banda (fase 3) ---------- */
    if (ST) bandBackground(gsap, ST);

    /* ---------- Enllaç amb # en obrir ---------- */
    if (ST) hashLanding(m);
  });

  /* El navegador salta a l’ancoratge (p. ex. #activacions) abans que el pin del relleu allargui
   * #territori: la pàgina quedaria dins del vol d’entrada. Un cop creats els disparadors es torna
   * a situar l’objectiu, només en una navegació nova (en recarregar es respecta el scroll restaurat).
   */
  function hashLanding(m) {
    if (!m.lenis || location.hash.length < 2) return;
    var nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    if (nav && nav.type !== 'navigate') return;
    var target = null;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) { return; }
    if (!target) return;
    var pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    // Lenis encara té el límit d’abans del pin (l’actualitza amb un ResizeObserver): es recalcula ara.
    if (typeof m.lenis.resize === 'function') m.lenis.resize();
    m.lenis.scrollTo(Math.max(0, Math.round(target.getBoundingClientRect().top + window.scrollY - pad)), { immediate: true });
  }

  /* Fons de banda. Amb moviment i amplada ≥ 900 px, el fons passa de paper a terreny en entrar
   * a #territori i torna a paper en entrar a #activacions, seguint el scroll, en lloc del tall sec.
   * Un fons fix (.band-backdrop, color del terreny) només canvia d’opacitat: sobre el paper és la
   * mateixa interpolació de color i no obliga a recalcular els estils de la pàgina a cada fotograma.
   * Tinta: la polaritat canvia al punt d’igual contrast entre tinta fosca i clara (t ≈ 0,61, uns
   * 4,1:1 en aquell instant); mentre el fons és a mig camí (band-strong) els grisos secundaris
   * prenen la tinta principal perquè no baixin de 4,5:1. Valors calculats per a --paper/--ground.
   * Els disparadors es creen després del pin del relleu (refreshPriority 1), que allarga #territori.
   */
  function bandBackground(gsap, ST) {
    var into = document.getElementById('territori');
    var out = document.getElementById('activacions');
    if (!into || !out) return;
    var root = document.documentElement;
    var STRONG_FROM = 0.2, GROUND_FROM = 0.612, STRONG_TO = 0.78;

    var mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', function () {
      var backdrop = document.createElement('div');
      backdrop.className = 'band-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(backdrop, document.body.firstChild);
      var pIn = 0, pOut = 0, last = -1;

      function flag(cls, on) { if (root.classList.contains(cls) !== on) root.classList.toggle(cls, on); }
      function paint() {
        var t = pIn * (1 - pOut);
        if (t === last) return;
        last = t;
        backdrop.style.opacity = String(Math.round(t * 1000) / 1000);
        flag('band-ground', t >= GROUND_FROM);
        flag('band-strong', t >= STRONG_FROM && t < STRONG_TO);
      }
      function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
      function onIn(self) { pIn = self.progress; paint(); }
      // En finestres altes, «top 92%» de #activacions pot caure dins del tram final del pin:
      // el retorn al paper no comença fins que el relleu s’ha alliberat.
      function onOut(self) {
        var pin = ST.getById('terrain-pin'), from = self.start;
        if (pin && pin.end > from) from = Math.min(pin.end, self.end - 1);
        pOut = clamp01((self.scroll() - from) / (self.end - from));
        paint();
      }

      root.classList.add('band-on');
      // Tram tardà: quan el fons arriba a mig camí, la taula de dades ja és gairebé fora de la vista.
      // Acaba abans del pin del relleu, que comença amb #territori a un 12–17 % de l’alçada.
      var a = ST.create({ trigger: into, start: 'top 55%', end: 'top 22%', onUpdate: onIn, onToggle: onIn, onRefresh: onIn });
      // clamp(): al final de la pàgina el retorn al paper sempre es completa.
      var b = ST.create({ trigger: out, start: 'top 92%', end: 'clamp(top 60%)', onUpdate: onOut, onToggle: onOut, onRefresh: onOut });
      onIn(a); onOut(b);
      ST.sort();

      return function () {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        root.classList.remove('band-on', 'band-ground', 'band-strong');
      };
    });
  }

  /* Vol d’entrada del relleu. Escenari fixat (+=120 %) on el progrés 0 → 0,85 porta la càmera
   * de la vista zenital (nord amunt) a l’obliqua per defecte i escombra les corbes de 1.200 a
   * 2.500 m; el 15 % final allibera el relleu. Només amb moviment i amplada ≥ 900 px; si no,
   * no hi ha pin i el relleu surt en la vista final amb totes les corbes. El pin no depèn que
   * terreny.js existeixi: la vista es governa quan LINE.continental.terrain es resol.
   */
  function terrainFlight(m, gsap, ST) {
    var layout = one('#territori .terrain-layout');
    if (!layout) return;
    var header = one('.top');
    var low = one('[data-cota="baixa"]');
    var high = one('[data-cota="alta"]');
    var page = window.LINE.continental;
    var FROM = { yaw: 0, pitch: 0.97, scale: 0.8 };
    var TO = { yaw: 2.72, pitch: 0.46, scale: 1 };
    var FLY_END = 0.85, SWEEP_START = 0.04, SWEEP_END = 0.8;
    var LEVEL_FROM = 1200, LEVEL_TO = 2500;
    var LOW_COTA = 1221, PEAK_COTA = 2481;
    var COMPACT_HEAD = 56;   // = min-height de .top.is-compact .mast (style.css)
    var curve = gsap.parseEase('power2.inOut');
    var terrain = null, userOwns = false, active = false, progress = 0;

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function lit(node, on) { if (node && node.classList.contains('is-lit') !== on) node.classList.toggle('is-lit', on); }
    function levelAt(p) {
      if (p >= FLY_END) return Infinity;
      return LEVEL_FROM + (LEVEL_TO - LEVEL_FROM) * clamp01((p - SWEEP_START) / (SWEEP_END - SWEEP_START));
    }
    function apply() {
      if (!active || userOwns) { lit(low, false); lit(high, false); return; }
      var level = levelAt(progress);
      // La franja groga és (levelMax − 100, levelMax]: la xifra s’encén mentre la franja hi passa.
      lit(low, level >= LOW_COTA && level < LOW_COTA + 250);
      lit(high, Number.isFinite(level) && level >= PEAK_COTA - 60);
      if (!terrain) return;
      var e = curve(clamp01(progress / FLY_END));
      terrain.setView({
        yaw: FROM.yaw + (TO.yaw - FROM.yaw) * e,
        pitch: FROM.pitch + (TO.pitch - FROM.pitch) * e,
        scale: FROM.scale + (TO.scale - FROM.scale) * e,
        levelMax: level
      }, { immediate: true });
    }
    function release() {
      if (terrain) terrain.setView({ yaw: TO.yaw, pitch: TO.pitch, scale: TO.scale, levelMax: Infinity }, { immediate: true });
    }

    if (page && page.terrain) {
      page.terrain.then(function (t) {
        terrain = t;
        // Quan la persona agafa el relleu, el scroll deixa de moure la càmera per a la resta de la visita.
        // La vista acaba el vol sola (inclinació i escala finals, amb el bucle amorteit) i conserva
        // el gir de la persona; així el tram de pin que queda no deixa el relleu en una pose a mig vol.
        // terreny.js crida aquest callback abans de llegir la vista objectiu: el gest, les tecles i el
        // zoom parteixen ja de la vista final i no salten.
        t.onUserInput(function () {
          if (userOwns) return;
          userOwns = true;
          lit(low, false); lit(high, false);
          t.setView({ pitch: TO.pitch, scale: TO.scale, levelMax: Infinity });
        });
        // Amb la pàgina oberta dins del pin (recàrrega, scroll restaurat, enllaç amb #), el refresh
        // ja ha posat el progrés del pin sense cridar onUpdate: es llegeix aquí abans de dibuixar.
        var pin = ST.getById('terrain-pin');
        if (pin && pin.animation) progress = pin.animation.progress();
        if (active) apply();
      });
    }

    var mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', function () {
      active = true;
      var proxy = { p: 0 };
      gsap.to(proxy, {
        p: 1,
        ease: 'none',
        onUpdate: function () { progress = proxy.p; apply(); },
        scrollTrigger: {
          trigger: layout,
          // L’escenari queda centrat a l’espai sota la capçalera compacta. Quan el pin comença la
          // portada ja ha sortit i la capçalera sempre és compacta: s’usa la seva alçada fixa
          // (.top.is-compact .mast, style.css), no la mesurada, que depèn de quan es fa el refresh.
          // Si no hi cap, el desbordament es menja primer el farciment superior de l’escenari.
          start: function () {
            var head = header ? COMPACT_HEAD : 0;
            var room = window.innerHeight - head - layout.offsetHeight;
            var pad = parseFloat(getComputedStyle(layout).paddingTop) || 0;
            var y = room >= 0 ? head + room / 2 : head - Math.min(pad, -room);
            return 'top top+=' + Math.round(y);
          },
          end: '+=120%',
          id: 'terrain-pin',   // bandBackground() en llegeix el final
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
          // El refresh fixa el progrés de l’animació sense onUpdate: la càmera s’hi posa igualment.
          onRefresh: function () { progress = proxy.p; apply(); },
          // El disparador de l’scrollspy de #territori comença al mateix punt: el pin s’ha de
          // calcular abans perquè el final de la secció ja inclogui l’espai del pin.
          refreshPriority: 1
        }
      });
      // Els disparadors de més avall (scrollspy, entrades) s’han de recalcular després del pin.
      ST.sort();
      return function () {
        active = false;
        lit(low, false); lit(high, false);
        if (!userOwns) release();
      };
    });
    ST.refresh();
  }

  // Comptadors de les xifres de temporada (null → «Pendent», sense animació).
  function countKpis(m) {
    var strip = one('#kpis');
    all('#kpis .kpi-value').forEach(function (out, i) {
      var raw = out.getAttribute('data-value');
      var value = raw === null || raw === '' ? null : Number(raw);
      m.countUp(out, value, {
        decimals: Number(out.getAttribute('data-decimals')) || 0,
        suffix: out.getAttribute('data-suffix') || '',
        trigger: strip,
        start: 'top 82%',
        delay: i * 0.08
      });
    });
  }
})();
