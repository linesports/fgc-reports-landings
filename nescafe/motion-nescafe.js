/* NESCAFÉ · moviment de pàgina (fase 1)
 * S’executa després de quadern.js, quan LINE.motion és a punt. Tot és opcional:
 * sense la capa de moviment o amb moviment reduït, la pàgina queda en l’estat final.
 */
(function () {
  'use strict';

  var LINE = window.LINE;
  if (!LINE || !LINE.motion) return;

  function one(selector) { return document.querySelector(selector); }
  function all(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector)).filter(function (el) {
      return !el.closest('[hidden]');
    });
  }
  function finite(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }

  LINE.motion.onReady(function (m) {
    var data = window.EDICIO_NESCAFE || {};
    var sorteig = data.sorteig || {};

    // Sorteig: recompte en entrar (amb moviment reduït només escriu el valor; null → "Pendent").
    m.countUp(one('#entries'), finite(sorteig.participacions), { duration: 1.4, start: 'top 88%' });
    m.countUp(one('#views'), finite(sorteig.paginesVistes), { duration: 1.4, delay: 0.12, start: 'top 88%' });

    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;
    var cover = one('.cover');

    /* ---------- Capçalera condensada després de la portada ----------
       És un canvi d’estat, no decoració: també funciona amb moviment reduït
       (les transicions CSS ja queden anul·lades). Sense `end`/toggleClass, perquè
       a progrés 1 (final de la pàgina) el disparador es desactivaria i la capçalera
       tornaria a créixer. */
    var mast = one('.mast');
    if (gsap && ScrollTrigger && mast && cover) {
      var setCondensed = function (on) { mast.classList.toggle('is-condensed', on); };
      var condense = ScrollTrigger.create({
        trigger: cover,
        start: 'bottom top+=80',
        onEnter: function () { setCondensed(true); },
        onLeaveBack: function () { setCondensed(false); },
        onRefresh: function (self) { setCondensed(self.scroll() > self.start); }
      });
      setCondensed(condense.scroll() > condense.start);
    }

    if (!m.enabled) return;

    /* ---------- Portada: l’única entrada llarga de la pàgina ---------- */
    if (cover) {
      var h1 = one('#headline');
      var label = one('.cover .label');
      var deck = one('#cover-deck');
      var cta = one('.cover .cta');
      var frame = one('.cover-frame');
      var drift = one('.cover-drift');
      var img = frame && frame.querySelector('img');
      var caption = one('.cover-visual figcaption');
      var running = one('.running');
      var runningRule = one('.running .rule');

      var tl = gsap.timeline({ defaults: { ease: m.ease.out } });
      if (runningRule) tl.fromTo(runningRule, { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: 1.2 }, 0);
      if (frame) tl.fromTo(frame, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: m.ease.io, clearProps: 'clipPath' }, 0.1);
      if (img) tl.fromTo(img, { scale: 1.08 }, { scale: 1, duration: 1.6 }, 0.1);
      if (label) tl.from(label, { autoAlpha: 0, y: 14, duration: 0.8 }, 0.15);
      if (deck) tl.from(deck, { autoAlpha: 0, y: 18, duration: 0.9 }, 0.55);
      if (cta) {
        tl.from(cta, {
          autoAlpha: 0, y: 18, duration: 0.9,
          // El magnetisme comença quan l’entrada ha acabat, perquè no lluitin per la mateixa y.
          onComplete: function () { m.magnetic(cta, { strength: 0.3, radius: 70 }); }
        }, 0.68);
      }
      if (caption) tl.from(caption, { autoAlpha: 0, duration: 0.6, ease: m.ease.soft }, 1.1);
      // h1: «Un cafè» puja línia a línia i la línia vermella en cursiva la segueix.
      if (h1) m.reveal(h1, { load: true, delay: 0.2, duration: 1.1, stagger: 0.14 });

      // Sortida de la portada amb scrub: la imatge creix i puja; la línia de capçalera s’apaga.
      if (drift) {
        gsap.set(drift, { transformOrigin: '50% 0%' });
        gsap.to(drift, { scale: 1.06, yPercent: -6, ease: 'none', scrollTrigger: { trigger: cover, start: 0, end: 'bottom top', scrub: true } });
      }
      if (running) {
        gsap.to(running, { opacity: 0, y: -8, ease: 'none', scrollTrigger: { trigger: cover, start: 0, end: 90, scrub: true } });
      }

      // Punter fi: imatge ±8 px contra el cursor, títol ±2 px amb el cursor.
      if (m.fine && img && h1) {
        var imgX = gsap.quickSetter(img, 'x', 'px');
        var imgY = gsap.quickSetter(img, 'y', 'px');
        var h1X = gsap.quickSetter(h1, 'x', 'px');
        var h1Y = gsap.quickSetter(h1, 'y', 'px');
        m.pointer(cover, function (nx, ny) {
          imgX(-nx * 8); imgY(-ny * 8);
          h1X(nx * 2); h1Y(ny * 2);
        });
      }
    }

    /* ---------- Títols de capítol ---------- */
    all('main h2').forEach(function (h2) { m.reveal(h2, { start: 'top 86%' }); });

    /* ---------- Blocs i files ---------- */
    // Només opacitat i y (mai visibility): els controls continuen sent focusables i a l’arbre d’accessibilitat.
    // Del full de contactes s’animen els fills, no el full: el full es fixa en mode pel·lícula
    // i un transform al mateix element que el pin el desquadraria.
    rise(all('.story-body, .handoff, .giveaway-head > p, .station-head > p, .gallery-heading > p, .contact-sheet > *, .filterbar'), 20, 0.06);
    rise(all('.figures > div'), 28, 0.12);
    rise(all('#station-content > li'), 16, 0.06);

    function rise(els, y, each) {
      if (!els.length) return;
      gsap.set(els, { opacity: 0, y: y });
      ScrollTrigger.batch(els, {
        start: 'top 90%',
        once: true,
        onEnter: function (batch) {
          gsap.to(batch, {
            // 'auto' i no true: true mataria qualsevol altra interpolació dels mateixos
            // elements (p. ex. el filet --draw de .figures > div), no només opacitat i y.
            opacity: 1, y: 0, duration: 0.8, ease: m.ease.out, overwrite: 'auto',
            stagger: { each: each, amount: Math.min(0.5, each * batch.length) },
            clearProps: 'transform,opacity'
          });
        }
      });
      // Un control enfocat amb teclat abans d’entrar al viewport es mostra de seguida.
      els.forEach(function (el) {
        el.addEventListener('focusin', function () {
          if (el.style.opacity === '') return;
          gsap.to(el, { opacity: 1, y: 0, duration: m.dur.d3, ease: m.ease.out, overwrite: 'auto', clearProps: 'transform,opacity' });
        });
      });
    }

    // Filets superiors de les xifres: pseudo-element amb scaleX(var(--draw)).
    var figures = all('.figures > div');
    if (figures.length) {
      gsap.fromTo(figures, { '--draw': 0 }, {
        '--draw': 1, duration: 1.1, ease: m.ease.out, stagger: 0.12,
        scrollTrigger: { trigger: figures[0].parentNode, start: 'top 90%', once: true }
      });
    }

    /* ---------- Crònica i sorteig (fase 2): es creen abans que el quadern, en ordre de pàgina ---------- */
    signature(m, gsap, ScrollTrigger);

    /* ---------- Quadern: full de contactes → pel·lícula guiada pel desplaçament (fase 2) ---------- */
    film(m, gsap, ScrollTrigger);

    // Mesura final amb tots els pins. Si la càrrega ja ha passat, motion.js no la tornarà a disparar;
    // si les fonts encara no han arribat (espera màxima d’1,5 s a motion.js), es torna a mesurar després.
    ScrollTrigger.refresh();
    if (document.fonts && document.fonts.status !== 'loaded') {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }
  });

  // Capçalera condensada + filet inferior: on s’aturen els elements fixats.
  function mastOffset() {
    var mast = one('.mast');
    var condensed = mast ? parseFloat(getComputedStyle(mast).getPropertyValue('--mast-c')) : 0;
    return (condensed || 52) + 1;
  }

  /* Moments de la crònica i del sorteig. Només amb moviment i amplada ≥ 900 px;
     per sota, el comportament de la fase 1 (cita en vermell, banda sencera). */
  function signature(m, gsap, ScrollTrigger) {
    if (!m.enabled || !gsap.matchMedia) return;
    var story = one('#cronica .story');
    var quote = one('#story-title');
    var band = one('.giveaway');
    gsap.matchMedia().add('(min-width: 900px)', function () {
      var undo = [];
      if (story && quote && window.SplitText) undo.push(cronica(gsap, story, quote, one('#cronica')));
      if (band) undo.push(sorteigBand(ScrollTrigger, band));
      return function () {
        undo.forEach(function (fn) { if (fn) fn(); });
        requestAnimationFrame(function () { ScrollTrigger.refresh(); });
      };
    });
  }

  /* Crònica: pin curt (+=60vh). El títol es queda quiet mentre la cita s’omple paraula a paraula
     del gris de paper a la tinta vermella. Només la cita es divideix; el cos no s’anima. */
  function cronica(gsap, story, quote, section) {
    var red = getComputedStyle(quote).color;
    var split = window.SplitText.create(quote, { type: 'words', tag: 'span', wordsClass: 'ink-word', aria: 'none' });
    if (!split.words || !split.words.length) { split.revert(); return null; }
    var tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: story,
        pin: story,
        pinSpacing: true,
        // Centrat a l’espai sota la capçalera; si no hi cap, enganxat a dalt.
        start: function () {
          var top = mastOffset();
          var avail = window.innerHeight - top;
          return story.offsetHeight < avail - 48 ? 'center ' + Math.round(top + avail / 2) + 'px' : 'top ' + (top + 24) + 'px';
        },
        end: function () { return '+=' + Math.round(window.innerHeight * 0.6); },
        scrub: 0.4,
        invalidateOnRefresh: true,
        // És més amunt que el pin del quadern (refreshPriority 1): s’ha de mesurar abans.
        refreshPriority: 2,
        onRefresh: function (self) { landAtStart(self); }
      }
    });
    // Els enllaços a #cronica (índex, «Llegir la crònica», salt) arriben a l’inici del pin, amb la cita
    // encara per omplir, i no a mig scrub. Lenis i el navegador ja resten scroll-margin-top.
    function landAtStart(self) {
      if (!section) return;
      section.style.scrollMarginTop = '';
      var pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      var landing = section.getBoundingClientRect().top + window.scrollY - pad;
      var extra = Math.round(landing - self.start);
      if (extra > 0) section.style.scrollMarginTop = extra + 'px';
    }
    // #8f8474 sobre el paper: 3,28:1, llegible com a text gran abans que el scrub hi arribi.
    tl.fromTo(split.words, { color: '#8f8474' }, { color: red, duration: 1, stagger: 0.55 });
    tl.to({}, { duration: 0.5 });   // la cita plena es manté un moment abans d’alliberar el pin
    return function () {
      split.revert();
      if (section) section.style.scrollMarginTop = '';
    };
  }

  /* Sorteig: la banda vermella creix d’un marge de 4vw a sang durant els ~40vh abans d’arribar
     sota la capçalera. És un retall pur: els marges laterals (el fons darrere la banda) són paper
     pla mentre es veuen i passen a vermell quan la banda ja és a sang, sense cap to intermedi.
     Sense scrub de GSAP: el progrés ja és suau amb Lenis. */
  function sorteigBand(ScrollTrigger, band) {
    var last = -1;
    function inOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function paint(p) {
      p = Math.round(p * 1000) / 1000;
      if (p === last) return;
      last = p;
      var inset = (1 - inOut(p)) * 4;
      band.style.setProperty('--band-inset', inset.toFixed(3) + 'vw');
      band.style.setProperty('--band-gutter', inset < 0.005 ? '#8c241e' : 'var(--paper)');
    }
    band.classList.add('is-band');
    var st = ScrollTrigger.create({
      trigger: band,
      start: function () { return 'top ' + Math.round(mastOffset() + window.innerHeight * 0.4) + 'px'; },
      end: function () { return 'top ' + mastOffset() + 'px'; },
      invalidateOnRefresh: true,
      onUpdate: function (self) { paint(self.progress); },
      onRefresh: function (self) { paint(self.progress); }
    });
    paint(st.progress);
    return function () {
      st.kill();
      band.classList.remove('is-band');
      band.style.removeProperty('--band-inset');
      band.style.removeProperty('--band-gutter');
    };
  }

  /* El full de contactes es fixa sota la capçalera durant n × 45vh i el progrés tria la peça.
     Només amb moviment, finestra ≥ 900 × 640 i 3–8 peces; fora d’això, el visor clàssic de la fase 1.
     L’estat sempre surt de la posició: miniatures, fletxes, tecles i clics desplacen fins a la peça. */
  function film(m, gsap, ScrollTrigger) {
    var Q = LINE.quadern;
    if (!m.enabled || !Q || !gsap.matchMedia || Q.count < 3 || Q.count > 8) return;

    var n = Q.count;
    var section = one('#quadern');
    var sheet = one('.contact-sheet');
    var stage = one('#stage');
    var side = one('.gallery-side');
    var thumbs = one('#thumbs');
    var head = one('.thumb-head');
    var mast = one('.mast');
    if (!section || !sheet || !stage || !side || !thumbs || !head) return;

    var buttons = Array.prototype.slice.call(thumbs.querySelectorAll('button'));
    var active = false;
    var st = null;
    var suppress = false;
    var releaseTimer = 0;
    var slots = [];
    var ink = null;
    var peek = null;
    var settled = 0;          // última peça on el full ha quedat quiet: referència de l’ajust
    var chosenBy = 'api';     // origen de la peça actual (scroll, control, api…)
    var keep = -1;            // peça a conservar mentre un canvi de mida recalcula el pin
    var resized = false;

    function pad(value) { return (value < 10 ? '0' : '') + value; }
    function isVideo(i) { return Q.items[i] && Q.items[i].tipus === 'video'; }
    function indexAt(progress) { return Math.max(0, Math.min(n - 1, Math.round(progress * (n - 1)))); }
    function positionOf(i) { return Math.round(st.start + (st.end - st.start) * i / (n - 1)); }
    // Alçada de la capçalera condensada (sempre ho és en arribar al quadern) + aire.
    function filmTop() {
      var condensed = mast ? parseFloat(getComputedStyle(mast).getPropertyValue('--mast-c')) : 0;
      return (condensed || 52) + 1 + 16;
    }
    // On es fixa el full: centrat a l’espai sota la capçalera, com la crònica; si no hi cap, a filmTop().
    function pinTop() {
      var top = filmTop() - 16;
      return Math.round(top + Math.max(16, (window.innerHeight - top - sheet.offsetHeight) / 2));
    }
    // Terç de l’escenari sota el punter: -1 anterior, 0 ampliar, 1 següent.
    function zone(e) {
      var box = stage.getBoundingClientRect();
      var x = (e.clientX - box.left) / box.width;
      return x < 1 / 3 ? -1 : x > 2 / 3 ? 1 : 0;
    }

    /* Etiqueta del cursor: es registra una sola vegada (motion.js no en permet treure-la)
       i calla fora del mode pel·lícula i sobre els vídeos, que tenen controls propis. */
    if (m.fine) {
      m.cursorLabel(stage, function (e) {
        if (!active || isVideo(Q.index)) return '';
        var z = zone(e);
        return z < 0 ? 'Anterior' : z > 0 ? 'Següent' : 'Ampliar';
      });
    }

    /* ---------- Comptador en serif: cada xifra roda en la direcció del recorregut ---------- */
    function buildCounter() {
      var counter = document.createElement('div');
      counter.className = 'film-counter';
      counter.setAttribute('aria-hidden', 'true');
      var now = document.createElement('span');
      now.className = 'film-now';
      slots = [];
      for (var k = 0; k < 2; k++) {
        var slot = document.createElement('span');
        slot.className = 'film-slot';
        now.appendChild(slot);
        slots.push(slot);
      }
      var total = document.createElement('span');
      total.className = 'film-total';
      total.textContent = '/ ' + pad(n);
      counter.appendChild(now);
      counter.appendChild(total);
      return counter;
    }
    function setCounter(i, direction, instant) {
      var text = pad(i + 1);
      var dir = direction < 0 ? -1 : 1;
      slots.forEach(function (slot, k) {
        var current = slot.lastElementChild;
        if (current && current.textContent === text[k] && !current._leaving) return;
        var digit = document.createElement('span');
        digit.textContent = text[k];
        if (instant || !current) { slot.replaceChildren(digit); return; }
        current._leaving = true;
        slot.appendChild(digit);
        gsap.fromTo(digit, { yPercent: 100 * dir }, { yPercent: 0, duration: 0.6, ease: m.ease.out });
        gsap.to(current, { yPercent: -100 * dir, duration: 0.6, ease: m.ease.out, overwrite: true, onComplete: function () { current.remove(); } });
      });
    }

    /* ---------- Indicador vermell: un sol element que llisca entre miniatures ---------- */
    function moveInk(instant) {
      var button = buttons[Q.index];
      if (!ink || !button) return;
      gsap.to(ink, {
        x: button.offsetLeft, y: button.offsetTop, width: button.offsetWidth, height: button.offsetHeight,
        duration: instant ? 0 : 0.55, ease: m.ease.out, overwrite: 'auto'
      });
    }
    function onRefresh() {
      if (keep >= 0 && st) { var i = keep; keep = -1; jumpTo(i); }
      moveInk(true);
    }

    /* ---------- Peu de la miniatura en passar-hi per sobre ---------- */
    var peekIndex = -1;
    function showPeek(i) {
      if (!peek || i === peekIndex) return;
      peekIndex = i;
      if (i < 0) { gsap.to(peek, { opacity: 0, duration: m.dur.d2, ease: m.ease.soft, overwrite: true }); return; }
      peek.textContent = pad(i + 1) + ' · ' + Q.items[i].alt;
      gsap.fromTo(peek, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: m.dur.d3, ease: m.ease.out, overwrite: true });
    }
    function onThumbOver(e) {
      var button = e.target.closest && e.target.closest('button');
      if (button && thumbs.contains(button)) showPeek(buttons.indexOf(button));
    }
    function onThumbsLeave() { showPeek(-1); }

    /* ---------- Navegació: sempre a través del desplaçament ---------- */
    function release() {
      clearTimeout(releaseTimer);
      if (!suppress) return;
      suppress = false;
      // Visor obert (p. ex. Lenis aturat a mig desplaçament): no es canvia la peça que s’està
      // mirant; en tancar, syncAfterLightbox porta el desplaçament a la peça triada.
      if (Q.isOpen) return;
      if (st) {
        var i = indexAt(st.progress);
        if (i !== Q.index) Q.select(i, { source: 'scroll' });
        settled = i;
      }
    }
    function goTo(index, direction) {
      if (!st) return false;
      var i = ((index % n) + n) % n;
      var distance = Math.abs(i - Q.index);
      if (i !== Q.index) Q.select(i, { source: 'control', direction: direction || (i > Q.index ? 1 : -1) });
      settled = i;
      var target = positionOf(i);
      if (Math.abs(st.scroll() - target) < 2) return true;
      // Estat immediat; el desplaçament el segueix sense passar per les peces intermèdies.
      suppress = true;
      clearTimeout(releaseTimer);
      var duration = Math.min(1.1, 0.55 + 0.1 * Math.max(1, distance));
      m.scrollTo(target, { duration: duration, focus: false, onComplete: release });
      releaseTimer = setTimeout(release, duration * 1000 + 500);
      return true;
    }
    function intercept(index, info) { return goTo(index, info.direction); }
    function followScroll(self) {
      // keep ≥ 0: un canvi de mida està recalculant; onRefresh tornarà a la peça guardada.
      if (suppress || keep >= 0 || Q.isOpen || self.scroll() < self.start - 1) return;
      var i = indexAt(self.progress);
      if (i !== Q.index) Q.select(i, { source: 'scroll', direction: i > Q.index ? 1 : -1 });
    }
    // En tancar el visor després d’haver-hi canviat de peça: salt sense animació a la seva posició.
    // Només si el full és fix (desplaçament dins el tram del pin, extrems inclosos): llavors a la
    // pantalla no es mou res. Fora del pin l’escenari conserva la peça triada i, en entrar-hi,
    // onUpdate torna a triar per posició.
    function syncAfterLightbox(index) {
      clearTimeout(releaseTimer);
      suppress = false;
      if (!st) return;
      var scroll = st.scroll();
      if (scroll < st.start - 1 || scroll > st.end + 1 || indexAt(st.progress) === index) return;
      jumpTo(index);
    }
    // Salt sense animació a la posició d’una peça (el full és fix: a la pantalla no es mou res).
    function jumpTo(index) {
      suppress = true;
      var target = positionOf(index);
      if (m.lenis) m.lenis.scrollTo(target, { immediate: true, force: true });
      else window.scrollTo(0, target);
      ScrollTrigger.update();
      suppress = false;
      settled = index;
    }
    // En sortir del pin d’un salt (Inici, Fi, un enllaç) l’escenari pot quedar en una peça de pas.
    // Si l’havia triat el desplaçament, es deixa la de l’extrem per on s’ha sortit; una peça triada
    // amb un control o una miniatura es conserva.
    function leaveAt(index) {
      settled = index;
      if (Q.isOpen || chosenBy !== 'scroll' || Q.index === index) return;
      Q.select(index, { source: 'scroll', direction: index > Q.index ? 1 : -1 });
      setCounter(index, 1, true);
      moveInk(true);
    }
    // Canvi de mida a mig pel·lícula: es guarda la peça abans de recalcular i s’hi torna després.
    function onResize() { resized = true; }
    function onRefreshInit() {
      keep = -1;
      if (!resized || !st) return;
      resized = false;
      var scroll = st.scroll();
      if (scroll >= st.start - 1 && scroll <= st.end + 1 && !Q.isOpen) keep = Q.index;
    }

    function onStageKey(e) {
      if (e.target !== stage || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        var dir = e.key === 'ArrowLeft' ? -1 : 1;
        goTo(Q.index + dir, dir);
      } else if (e.key === 'Enter' || e.key === ' ') {
        // També els vídeos: el focus és a l’escenari, no als controls natius del vídeo.
        e.preventDefault();
        Q.open();
      }
    }
    function onStageClick(e) {
      if (isVideo(Q.index) || e.target.tagName === 'VIDEO') return;
      var z = zone(e);
      if (z === 0) Q.open();
      else goTo(Q.index + z, z);
    }

    function onChange(i, info) {
      chosenBy = info.source;
      setCounter(i, info.direction, false);
      moveInk(false);
    }
    function pauseStage() {
      Array.prototype.forEach.call(stage.querySelectorAll('video'), function (video) { video.pause(); });
    }

    var unsubscribe = null;
    var unhook = null;

    function enable() {
      active = true;
      sheet.classList.add('is-film');
      sheet.style.setProperty('--film-top', filmTop() + 'px');
      thumbs.style.setProperty('--film-cols', n > 6 ? 4 : 3);

      var counter = buildCounter();
      side.insertBefore(counter, head);
      setCounter(Q.index, 1, true);

      ink = document.createElement('span');
      ink.className = 'film-ink';
      ink.setAttribute('aria-hidden', 'true');
      thumbs.appendChild(ink);

      if (m.fine) {
        peek = document.createElement('p');
        peek.className = 'film-peek';
        peek.setAttribute('aria-hidden', 'true');
        thumbs.insertAdjacentElement('afterend', peek);
        thumbs.addEventListener('pointerover', onThumbOver);
        thumbs.addEventListener('pointerleave', onThumbsLeave);
        stage.addEventListener('click', onStageClick);
      }

      stage.tabIndex = 0;
      stage.setAttribute('role', 'group');
      stage.setAttribute('aria-label', 'Escenari del quadern. Fletxes per canviar de peça, Retorn per ampliar.');
      stage.addEventListener('keydown', onStageKey);

      Q.slide = 24;
      Q.intercept(intercept);
      unsubscribe = Q.onChange(onChange);
      unhook = Q.onClose(syncAfterLightbox);

      // Pin curt i proporcional. refreshPriority: es recalcula abans que els disparadors
      // creats a la fase 1 que queden més avall (índex, files d’estacions), que així ja
      // mesuren amb l’espai del pin.
      st = ScrollTrigger.create({
        trigger: sheet,
        pin: sheet,
        pinSpacing: true,
        start: function () { return 'top top+=' + pinTop(); },
        end: function () { return '+=' + Math.round(n * 0.45 * window.innerHeight); },
        invalidateOnRefresh: true,
        refreshPriority: 1,
        // Ajust direccional: completa el pas en el sentit en què es llegia (una osca endavant
        // porta a la peça següent) i no torna mai enrere contra la roda. Un desplaçament
        // mínim (menys del 15 % del pas) es queda a la peça actual. El sentit surt de la peça on
        // el full era quiet (settled), no de self.direction: a l’últim fotograma de Lenis aquest pot
        // girar un instant i l’ajust tornava enrere. settled només canvia quan el full arriba a una
        // peça; si Lenis interromp l’ajust i es recalcula, la referència continua sent la de partida.
        snap: {
          snapTo: function (value) {
            var k = value * (n - 1);
            if (Math.abs(k - Math.round(k)) < 0.01) settled = Math.max(0, Math.min(n - 1, Math.round(k)));
            var i = k > settled + 0.15 ? Math.ceil(k - 0.15) : k < settled - 0.15 ? Math.floor(k + 0.15) : settled;
            return Math.max(0, Math.min(n - 1, i)) / (n - 1);
          },
          duration: { min: 0.2, max: 0.45 },
          delay: 0.08,
          ease: 'power2.inOut',
          inertia: false,
          onComplete: function (self) { settled = indexAt(self.progress); }
        },
        // Amb el visor obert, la posició no tria peça (showSelection la pintaria dins el visor).
        // Abans del pin tampoc: el full encara no s’ha fixat i es conserva la peça triada
        // (p. ex. una miniatura escollida al visor clàssic abans d’eixamplar la finestra).
        onUpdate: followScroll,
        onRefresh: followScroll,
        onLeave: function () { leaveAt(n - 1); },
        onLeaveBack: function () { leaveAt(0); }
      });

      // Cap vídeo continua sonant quan el quadern surt de la pantalla.
      ScrollTrigger.create({ trigger: section, start: 'top bottom', end: 'bottom top', onLeave: pauseStage, onLeaveBack: pauseStage });

      ScrollTrigger.addEventListener('refreshInit', onRefreshInit);
      ScrollTrigger.addEventListener('refresh', onRefresh);
      window.addEventListener('resize', onResize, { passive: true });
      ScrollTrigger.refresh();
      settled = st.scroll() > st.end ? n - 1 : st.scroll() < st.start ? 0 : indexAt(st.progress);
      moveInk(true);
    }

    function disable() {
      active = false;
      suppress = false;
      clearTimeout(releaseTimer);
      st = null;   // el context de matchMedia ja mata els ScrollTriggers i desfà el pin
      Q.intercept(null);
      Q.slide = 0;
      if (unsubscribe) unsubscribe();
      if (unhook) unhook();
      ScrollTrigger.removeEventListener('refreshInit', onRefreshInit);
      ScrollTrigger.removeEventListener('refresh', onRefresh);
      window.removeEventListener('resize', onResize);
      keep = -1;
      resized = false;
      thumbs.removeEventListener('pointerover', onThumbOver);
      thumbs.removeEventListener('pointerleave', onThumbsLeave);
      stage.removeEventListener('click', onStageClick);
      stage.removeEventListener('keydown', onStageKey);
      stage.removeAttribute('tabindex');
      stage.removeAttribute('role');
      stage.removeAttribute('aria-label');
      var counter = side.querySelector('.film-counter');
      if (counter) counter.remove();
      if (ink) { gsap.killTweensOf(ink); ink.remove(); ink = null; }
      if (peek) { gsap.killTweensOf(peek); peek.remove(); peek = null; peekIndex = -1; }
      slots = [];
      sheet.classList.remove('is-film');
      sheet.style.removeProperty('--film-top');
      thumbs.style.removeProperty('--film-cols');
      requestAnimationFrame(function () { ScrollTrigger.refresh(); });
    }

    gsap.matchMedia().add('(min-width: 900px) and (min-height: 640px)', function () {
      enable();
      return disable;
    });
  }
})();
