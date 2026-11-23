'use strict';

const edition = window.EDICIO_NESCAFE;
const get = (id) => document.getElementById(id);
const number = new Intl.NumberFormat('ca-ES', {useGrouping: 'always'});
const media = Array.isArray(edition.galeria) ? edition.galeria : [];
const draw = edition.sorteig;
const dialog = get('lightbox');
let selection = 0;

get('cover-station').textContent = edition.estacio;
get('cover-deck').textContent = 'La crònica de l’activació de NESCAFÉ a ' + edition.estacio + ' i la resposta en línia al sorteig de ' + draw.nom + '.';
get('story-location').textContent = edition.estacio;
// El nom de l’estació no es parteix entre dues línies (La Molina): mateix text, espais no separables.
get('story-title').textContent = edition.estacio ? edition.titol.split(edition.estacio).join(edition.estacio.replace(/ /g, '\u00a0')) : edition.titol;
get('story-text').textContent = edition.cronica;
get('draw-name').textContent = 'de ' + draw.nom + '.';
get('cutoff').textContent = 'Tall de ' + draw.tall.toLocaleLowerCase('ca');
get('cutoff-day').textContent = draw.tall.toLocaleLowerCase('ca');
const formatCount = (value) => Number.isFinite(value) ? number.format(value) : 'Pendent';
get('entries').textContent = formatCount(draw.participacions);
get('views').textContent = formatCount(draw.paginesVistes);
// L’enllaç de l’índex ja surt visible a l’HTML (la capçalera no canvia d’amplada en carregar); sense galeria s’amaga.
get('gallery-link').hidden = !media.length;

// Últim canvi demanat per contenidor: si n’arriba un altre abans de descodificar, el primer es descarta.
const swapTokens = new WeakMap();

// Ganxos del quadern per a la capa de moviment (motion-nescafe.js), exposats a window.LINE.quadern.
// Un sol nom global: aquest fitxer comparteix l’àmbit amb els altres scripts clàssics.
const quadernHooks = {
  listeners: new Set(),   // cb(index, {previous, direction, source})
  closing: new Set(),     // cb(index) mentre el visor es tanca, abans que la peça torni a l’escenari
  interceptor: null,      // fn(index, {source, direction}) → true si gestiona el canvi (mode pel·lícula)
  slide: 0,               // px de desplaçament direccional en canviar de peça (0 = fosa clàssica)
  // L’escenari i les precàrregues esperen que el quadern s’acosti (vegeu més avall): mentre es llegeix
  // la portada, la pàgina no baixa les fotografies grans.
  near: !('IntersectionObserver' in window),
  preloaded: new Set(),
  preload(index) {
    if (!media.length || !this.near) return;
    const item = media[(index + media.length) % media.length];
    const src = item.tipus === 'video' ? item.poster : item.src;
    if (!src || this.preloaded.has(src)) return;
    this.preloaded.add(src);
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    if (typeof image.decode === 'function') image.decode().catch(() => {});
  }
};

function buildMedia(item) {
  let element;
  if (item.tipus === 'video') {
    element = document.createElement('video');
    element.controls = true;
    element.playsInline = true;
    element.preload = 'metadata';
    if (item.poster) element.poster = item.poster;
    element.setAttribute('aria-label', item.alt);
  } else {
    element = document.createElement('img');
    element.alt = item.alt;
  }
  element.src = item.src;
  return element;
}

// Espera el primer fotograma visible (imatge o pòster) perquè l’escenari no quedi buit.
function whenDecoded(element, item) {
  let source = element.tagName === 'IMG' ? element : null;
  if (!source && item.poster) { source = new Image(); source.src = item.poster; }
  if (!source || typeof source.decode !== 'function') return Promise.resolve();
  return source.decode().catch(() => {});
}

function pauseVideos(container, except) {
  for (const video of container.querySelectorAll('video')) if (video !== except) video.pause();
}

function motionEnabled() {
  return Boolean(window.LINE && window.LINE.motion && window.LINE.motion.enabled);
}

function renderMedia(container, item, direction) {
  const token = {};
  swapTokens.set(container, token);
  pauseVideos(container);
  const element = buildMedia(item);
  return whenDecoded(element, item).then(() => {
    if (swapTokens.get(container) !== token) return;
    const previous = Array.from(container.children);
    if (!previous.length || !motionEnabled() || typeof element.animate !== 'function') {
      container.replaceChildren(element);
      return;
    }
    // Fosa encadenada: la peça nova entra per sobre i l’anterior es retira en acabar.
    element.classList.add('is-entering');
    container.append(element);
    const settle = () => {
      if (element.parentNode !== container) return;
      for (const old of previous) if (old.parentNode === container) old.remove();
      element.classList.remove('is-entering');
    };
    const shift = quadernHooks.slide && direction ? quadernHooks.slide * Math.sign(direction) : 0;
    if (!shift) {
      element.animate([{opacity:0}, {opacity:1}], {duration:360, easing:'cubic-bezier(.16,1,.3,1)'}).finished.then(settle, settle);
      return;
    }
    // Mode pel·lícula: la nova entra lliscant en la direcció del recorregut; l’anterior se’n va
    // amb una sortida accelerada (un sol fotograma clau: parteix del valor actual, encara que
    // estigués entrant), així la cobertura no baixa a mig camí.
    for (const old of previous) {
      old.animate([{opacity:0, transform:'translateX(' + (-shift / 2) + 'px)'}], {duration:340, easing:'cubic-bezier(.7,0,.84,0)', fill:'forwards'});
    }
    element.animate([
      {opacity:0, transform:'translateX(' + shift + 'px)'},
      {opacity:1, transform:'translateX(0)'}
    ], {duration:520, easing:'cubic-bezier(.16,1,.3,1)'}).finished.then(settle, settle);
  });
}

// Mou el mateix element (vídeo inclòs) a un altre contenidor sense reiniciar-lo.
function moveMedia(element, container) {
  const playing = element.tagName === 'VIDEO' && !element.paused && !element.ended;
  // cancel() i no finish(): una sortida amb fill:'forwards' deixaria la peça invisible.
  if (element.getAnimations) for (const animation of element.getAnimations()) animation.cancel();
  element.classList.remove('is-entering');
  pauseVideos(container, element);
  container.replaceChildren(element);
  if (playing && element.paused) element.play().catch(() => {});
}

// Element de l’escenari que correspon a la peça seleccionada (el més recent, si n’hi ha dos en fosa).
function currentMedia(container) {
  const element = container.lastElementChild;
  return element && element.getAttribute('src') === media[selection].src ? element : null;
}

function setLightboxText(item, position) {
  get('lightbox-caption').textContent = item.alt;
  get('lightbox-title').textContent = edition.galeriaLloc + ' · ' + position;
}

function showSelection(index, options = {}) {
  const previous = selection;
  selection = (index + media.length) % media.length;
  const direction = options.direction || Math.sign(index - previous);
  const item = media[selection];
  const position = (selection + 1) + ' / ' + media.length;
  // Amb el visor obert només canvia el visor; l’escenari recupera la peça en tancar.
  if (dialog.open) renderMedia(get('lightbox-stage'), item, direction);
  else if (quadernHooks.near) renderMedia(get('stage'), item, direction);
  // En recórrer el quadern amb el desplaçament, el peu no s’anuncia a cada peça.
  get('media-caption').setAttribute('aria-live', options.source === 'scroll' ? 'off' : 'polite');
  get('media-caption').textContent = item.alt;
  get('media-count').textContent = position;
  for (const [i, button] of Array.from(get('thumbs').querySelectorAll('button')).entries()) {
    button.setAttribute('aria-pressed', String(selection === i));
  }
  if (dialog.open) setLightboxText(item, position);
  quadernHooks.preload(selection + 1);
  quadernHooks.preload(selection - 1);
  for (const listener of quadernHooks.listeners) {
    try { listener(selection, {previous, direction, source: options.source || 'api'}); } catch (error) { console.error('[quadern]', error); }
  }
}

// Canvi demanat per un control (miniatura, fletxes, lliscament). En mode pel·lícula la capa de
// moviment el converteix en desplaçament perquè posició i estat no se separin; amb el visor obert, mai.
// Dins quadernHooks i no com a funció global: aquest fitxer comparteix l’àmbit amb els altres scripts.
quadernHooks.request = function (index, source) {
  const direction = Math.sign(index - selection) || 1;
  const target = (index + media.length) % media.length;
  if (!dialog.open && this.interceptor && this.interceptor(target, {source, direction}) === true) return;
  showSelection(index, {source, direction});
};

// Miniatures de les peces de mostra: assets/mostra/miniatures/, 320 px pel costat curt. Les peces que
// afegeix l’editor (assets/edicio/) no en tenen i la miniatura carrega el fitxer sencer, com abans.
function thumbnailOf(src) {
  return /^assets\/mostra\/[^/]+\.webp$/.test(src) ? src.replace(/^assets\/mostra\//, 'assets/mostra/miniatures/') : src;
}

function appendThumbnails() {
  for (const [i, item] of media.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    const kind = item.tipus === 'video' ? 'Vídeo' : 'Fotografia';
    button.setAttribute('aria-label', kind + ' ' + (i + 1) + '. ' + item.alt);
    if (item.tipus !== 'video' || item.poster) {
      const image = document.createElement('img');
      image.loading = 'lazy';
      image.decoding = 'async';
      image.alt = '';
      const full = item.poster || item.src;
      // Si falta la miniatura, el fitxer sencer.
      image.addEventListener('error', () => { if (image.getAttribute('src') !== full) image.src = full; }, {once:true});
      image.src = thumbnailOf(full);
      button.append(image);
    }
    if (item.tipus === 'video') {
      const label = document.createElement('span');
      label.textContent = '▶ Vídeo';
      button.append(label);
    }
    button.addEventListener('click', () => quadernHooks.request(i, 'thumb'));
    get('thumbs').append(button);
  }
}

if (media.length) {
  get('quadern').hidden = false;
  const location = document.createElement('em');
  location.textContent = edition.galeriaLloc + '.';
  get('gallery-title').replaceChildren('Quadern de ', location);
  get('gallery-period').textContent = edition.galeriaPeriode;
  const images = media.filter((item) => item.tipus === 'imatge').length;
  const videos = media.filter((item) => item.tipus === 'video').length;
  const counts = [];
  if (images) counts.push(images + (images === 1 ? ' fotografia' : ' fotografies'));
  if (videos) counts.push(videos + (videos === 1 ? ' vídeo' : ' vídeos'));
  get('gallery-note').textContent = 'Arxiu de l’activació de NESCAFÉ a ' + edition.galeriaLloc + '. Selecció de ' + counts.join(' i ') + '.';
  // Filet de traspàs després de la crònica: només lloc i dates de l’arxiu, sense lligar-lo a la crònica.
  get('handoff-place').textContent = [edition.galeriaLloc, edition.galeriaPeriode].filter(Boolean).join(' · ');
  get('gallery-handoff').hidden = false;
  appendThumbnails();
  showSelection(0);
  // Primera peça a l’escenari i veïnes precarregades quan el quadern és a una pantalla de distància.
  if (!quadernHooks.near) {
    const nearby = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      nearby.disconnect();
      quadernHooks.near = true;
      if (!dialog.open && !get('stage').children.length) renderMedia(get('stage'), media[selection]);
      quadernHooks.preload(selection + 1);
      quadernHooks.preload(selection - 1);
    }, {rootMargin:'100% 0px 100% 0px'});
    // Es mesura amb la maquetació final: després que la capa de moviment hagi afegit l’espai dels pins.
    const watch = () => nearby.observe(get('quadern'));
    const motion = window.LINE && window.LINE.motion;
    if (motion && motion.ready) motion.onReady(() => requestAnimationFrame(watch));
    else watch();
  }
  for (const stage of [get('stage'), get('lightbox-stage')]) {
    let start;
    stage.addEventListener('touchstart', event => {
      const point = event.touches[0];
      start = event.touches.length === 1 && media[selection].tipus === 'imatge'
        ? {x:point.clientX, y:point.clientY} : null;
    }, {passive:true});
    stage.addEventListener('touchcancel', () => { start = null; });
    stage.addEventListener('touchend', event => {
      if (!start || event.touches.length) return;
      const point = event.changedTouches[0];
      const dx = point.clientX - start.x, dy = point.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 55 && Math.abs(dx) > 1.7 * Math.abs(dy)) {
        quadernHooks.request(selection + (dx < 0 ? 1 : -1), 'swipe');
      }
    }, {passive:true});
  }
  for (const control of document.querySelectorAll('[data-page]')) {
    control.addEventListener('click', () => quadernHooks.request(selection + Number(control.dataset.page), 'paging'));
  }

  /* ---------- Visor ampliat ----------
     Zoom d’element compartit de l’escenari al diàleg amb View Transitions del mateix document.
     Sense suport, amb moviment reduït o sense la capa de moviment: canvi instantani.
     El vídeo és sempre el mateix element (no es reinicia); la imatge es clona. */
  const lenis = () => (window.LINE && window.LINE.motion && window.LINE.motion.lenis) || null;
  const lightboxStage = get('lightbox-stage');
  const VT_NAME = 'quadern-media';
  let lightboxOpener = null;
  let restored = true;
  let morphing = false;

  const canMorph = () => motionEnabled() && typeof document.startViewTransition === 'function';

  // update() aplica el canvi de DOM i torna l’element d’arribada (o null).
  const morph = (from, update) => {
    if (!from || !canMorph()) { update(); return; }
    // Instantània neta: la fosa en curs de l’escenari acaba ara (settle retira les peces anteriors).
    if (from.getAnimations) for (const animation of from.getAnimations()) animation.cancel();
    from.style.viewTransitionName = VT_NAME;
    morphing = true;
    document.documentElement.classList.add('vt-quadern');
    const cleanup = () => {
      morphing = false;
      document.documentElement.classList.remove('vt-quadern');
      for (const node of [...get('stage').children, ...lightboxStage.children]) node.style.viewTransitionName = '';
    };
    let transition;
    try {
      transition = document.startViewTransition(() => {
        from.style.viewTransitionName = '';
        const to = update();
        if (to) to.style.viewTransitionName = VT_NAME;
      });
    } catch (error) {
      from.style.viewTransitionName = '';
      cleanup();
      update();
      return;
    }
    transition.ready.catch(() => {});
    transition.finished.catch(() => {}).then(cleanup);
  };

  function openLightbox() {
    if (dialog.open || morphing) return;
    const stage = get('stage');
    const item = media[selection];
    const current = currentMedia(stage);
    lightboxOpener = document.activeElement;
    swapTokens.set(stage, {});
    morph(current, () => {
      dialog.showModal();
      restored = false;
      let shown = null;
      if (current && current.tagName === 'VIDEO') { moveMedia(current, lightboxStage); shown = current; }
      else if (current) {
        shown = current.cloneNode();
        shown.classList.remove('is-entering');
        shown.style.viewTransitionName = '';
        lightboxStage.replaceChildren(shown);
      }
      else renderMedia(lightboxStage, item);
      setLightboxText(item, (selection + 1) + ' / ' + media.length);
      if (lenis()) lenis().stop();
      get('lightbox-close').focus();
      return shown;
    });
  }

  // Torna la peça del visor a l’escenari. Idempotent: s’executa dins la transició de tancament
  // o, si el diàleg s’ha tancat pel seu compte (Esc), en l’esdeveniment close.
  function restoreStage() {
    if (restored) return null;
    restored = true;
    const stage = get('stage');
    swapTokens.set(lightboxStage, {});
    if (lenis()) lenis().start();
    for (const hook of quadernHooks.closing) {
      try { hook(selection); } catch (error) { console.error('[quadern]', error); }
    }
    const current = currentMedia(lightboxStage);
    swapTokens.set(stage, {});
    let shown = null;
    if (current) { moveMedia(current, stage); shown = current; }
    else renderMedia(stage, media[selection]);
    pauseVideos(lightboxStage);
    lightboxStage.replaceChildren();
    return shown;
  }

  function closeLightbox() {
    if (!dialog.open || morphing) return;
    morph(currentMedia(lightboxStage), () => { dialog.close(); return restoreStage(); });
  }

  get('lightbox-open').addEventListener('click', openLightbox);
  get('lightbox-close').addEventListener('click', closeLightbox);
  // Esc: si el navegador deixa cancel·lar-lo, tanca amb la mateixa transició; si no, close fa la resta.
  dialog.addEventListener('cancel', (event) => {
    if (!event.cancelable || morphing || !canMorph()) return;
    event.preventDefault();
    closeLightbox();
  });
  // Clic al fons (fora de la caixa del diàleg), començat i acabat fora.
  const outsideDialog = (event) => {
    const box = dialog.getBoundingClientRect();
    return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  };
  let pressedOutside = false;
  dialog.addEventListener('pointerdown', (event) => { pressedOutside = event.target === dialog && outsideDialog(event); });
  dialog.addEventListener('click', (event) => {
    if (pressedOutside && event.target === dialog && outsideDialog(event)) closeLightbox();
    pressedOutside = false;
  });
  dialog.addEventListener('close', () => {
    restoreStage();
    const opener = lightboxOpener;
    lightboxOpener = null;
    // Safari no dona focus a un botó en clicar-lo: l'obridor pot ser body, que no compta.
    const valid = opener && opener !== document.body && opener.isConnected;
    if (valid) opener.focus({preventScroll:true});
    if (!valid || document.activeElement !== opener) get('lightbox-open').focus({preventScroll:true});
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.target.tagName === 'VIDEO') return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      quadernHooks.request(selection + (event.key === 'ArrowLeft' ? -1 : 1), 'dialog');
    }
  });

  // API per a la capa de moviment. select() no repeteix la peça actual (excepte amb force).
  window.LINE = window.LINE || {};
  window.LINE.quadern = {
    select(index, options = {}) {
      const target = ((Math.round(index) % media.length) + media.length) % media.length;
      if (target === selection && !options.force) return;
      showSelection(target, {source: options.source || 'api', direction: options.direction || Math.sign(target - selection) || 1});
    },
    get index() { return selection; },
    count: media.length,
    items: Object.freeze(media.slice()),
    onChange(callback) { quadernHooks.listeners.add(callback); return () => quadernHooks.listeners.delete(callback); },
    onClose(callback) { quadernHooks.closing.add(callback); return () => quadernHooks.closing.delete(callback); },
    intercept(handler) { quadernHooks.interceptor = typeof handler === 'function' ? handler : null; },
    get slide() { return quadernHooks.slide; },
    set slide(px) { quadernHooks.slide = Math.max(0, Number(px) || 0); },
    open: openLightbox,
    close: closeLightbox,
    get isOpen() { return dialog.open; }
  };
}

const stationNames = ['La Molina', 'Vall de Núria', 'Vallter', 'Espot Esquí', 'Port Ainé', 'Boí Taüll'];

function renderStations(filter) {
  const list = get('station-content');
  list.replaceChildren();
  for (const [index, name] of stationNames.entries()) {
    const hasStory = name === edition.estacio;
    const hasMedia = media.length && name === edition.galeriaLloc;
    if (filter === 'material' && !hasStory && !hasMedia) continue;
    const row = document.createElement('li');
    row.dataset.station = String(index);   // identitat estable per a la View Transition del filtre
    const heading = document.createElement('strong');
    heading.textContent = name;
    row.append(heading);
    const materials = document.createElement('div');
    if (hasStory) {
      const link = document.createElement('a');
      link.href = '#cronica';
      link.textContent = 'Llegir la crònica';
      materials.append(link);
    }
    if (hasMedia) {
      const link = document.createElement('a');
      link.href = '#quadern';
      link.textContent = 'Veure el quadern';
      if (hasStory) materials.append(' · ');
      materials.append(link);
    }
    if (!hasStory && !hasMedia) {
      const note = document.createElement('small');
      note.textContent = 'Sense material rebut';
      materials.append(note);
    }
    row.append(materials);
    list.append(row);
  }
  get('list-status').textContent = list.childElementCount + ' estacions visibles.';
  for (const button of document.querySelectorAll('[data-filter]')) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
  }
}

/* Filtre d’estacions. Amb moviment i suport: View Transition del mateix document, una
   view-transition-name per fila (st-0…st-5, per estació) i retards esglaonats a quadern.css.
   Sense: el canvi instantani de la fase 1. L’estat aria-live i aria-pressed els escriu renderStations. */
{
  const list = get('station-content');
  const root = document.documentElement;
  let current = 'all';
  let running = null;
  const refresh = () => { if (motionEnabled() && window.ScrollTrigger) window.ScrollTrigger.refresh(); };
  const nameRows = (on) => {
    for (const row of list.children) row.style.viewTransitionName = on ? 'st-' + row.dataset.station : '';
  };
  const applyFilter = (filter) => {
    const changed = filter !== current;
    current = filter;
    const before = list.offsetHeight;
    if (!changed || !motionEnabled() || typeof document.startViewTransition !== 'function') {
      if (filter === 'all') list.style.minHeight = '';
      renderStations(filter);
      if (list.offsetHeight !== before) refresh();
      return;
    }
    const token = {};
    running = token;
    const update = () => {
      // La llista filtrada conserva l’alçada de la completa: la pàgina no s’escurça
      // (ni el desplaçament salta a la vora inferior) mentre les files es mouen.
      list.style.minHeight = filter === 'all' ? '' : Math.max(before, parseFloat(list.style.minHeight) || 0) + 'px';
      renderStations(filter);
      nameRows(true);
      // L’alçada de la pàgina canvia: recalcula els ScrollTriggers (progrés de lectura, índex).
      if (list.offsetHeight !== before) refresh();
    };
    nameRows(true);
    root.classList.add('vt-stations');
    let transition;
    try {
      transition = document.startViewTransition(update);
    } catch (error) {
      running = null;
      root.classList.remove('vt-stations');
      update();
      nameRows(false);
      return;
    }
    transition.ready.catch(() => {});
    transition.finished.catch(() => {}).then(() => {
      if (running !== token) return;   // un clic posterior ja n’ha pres el relleu
      running = null;
      root.classList.remove('vt-stations');
      nameRows(false);
      // Les files ja han arribat: la reserva d’alçada deixa de fer falta i la pàgina s’escurça ara.
      if (filter !== 'all' && list.style.minHeight) {
        list.style.minHeight = '';
        refresh();
      }
    });
  };
  for (const button of document.querySelectorAll('[data-filter]')) {
    button.addEventListener('click', () => applyFilter(button.dataset.filter));
  }
  // L’alçada reservada només val per a l’amplada en què s’ha mesurat.
  window.addEventListener('resize', () => { if (list.style.minHeight) list.style.minHeight = ''; }, {passive:true});
}
renderStations('all');

// Índex de lectura: LINE.motion.navSpy (ScrollTrigger + indicador lliscant).
// Si la capa de moviment no hi és, un IntersectionObserver mínim marca la secció que creua el centre.
function startFallbackSpy(nav) {
  if (!nav || !('IntersectionObserver' in window)) return;
  const navLinks = Array.from(nav.querySelectorAll('a[href^="#"]')).filter((link) => !link.hidden && document.getElementById(link.hash.slice(1)));
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const link = navLinks.find((candidate) => candidate.hash === '#' + entry.target.id);
      if (!link) continue;
      if (entry.isIntersecting) {
        for (const other of navLinks) {
          if (other === link) other.setAttribute('aria-current', 'location');
          else other.removeAttribute('aria-current');
        }
      } else {
        link.removeAttribute('aria-current');
      }
    }
  }, {rootMargin:'-49% 0px -50% 0px'});
  for (const link of navLinks) observer.observe(document.getElementById(link.hash.slice(1)));
}

{
  const nav = document.querySelector('.mast nav');
  const motion = window.LINE && window.LINE.motion;
  if (motion && motion.ready) motion.onReady((m) => { if (!m.navSpy(nav)) startFallbackSpy(nav); });
  else startFallbackSpy(nav);
}
