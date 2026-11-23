/* Relleu de La Molina · Canvas 2D
 *
 * API pública (window.LINE.terreny):
 *   ready              Promise que es resol amb l’API quan el primer dibuix ja pot sortir amb la Lab.
 *   setView(v, o)      v = {yaw, pitch, scale, levelMax}; o = {immediate}. Sense immediate, la vista
 *                      hi arriba pel bucle amorteit. levelMax: corbes fins a aquesta cota i franja
 *                      just per sota en groc; Infinity = totes les corbes, cap franja.
 *   getView()          vista dibuixada ara mateix.
 *   onProbe(cb)        cb({elevation, distance}) o cb(null) quan el punter surt del relleu.
 *   onUserInput(cb)    cb(tipus) quan la persona arrossega, prem tecles, botons o fa zoom.
 *
 * Rendiment: tot el que no depèn de la vista es precalcula (pendents, pigments, paleta, segments
 * de corba per cel·la i per cota). En moviment es dibuixa a DPR 1,5 (1,25 en equips lents) i, quan s’atura, un sol cop a DPR 2.
 */
(() => {
  "use strict";
  const data = window.RELLEU_MOLINA;
  const canvas = document.getElementById("terreny");
  if (!data || !canvas) return;
  const ctx = canvas.getContext("2d", {alpha:false});
  if (!ctx) return;
  const LINE = window.LINE = window.LINE || {};

  const {n, sideMetres, heights} = data;
  const C = n - 1, NV = n * n, NC = C * C, half = C / 2;
  let minH = Infinity, maxH = -Infinity;
  for (const h of heights) { if (h < minH) minH = h; if (h > maxH) maxH = h; }
  const base = -0.034, vertical = 1.7;
  const DEFAULT = {yaw:2.72, pitch:.46, scale:1};
  const PITCH_MIN = .25, PITCH_MAX = .97;        // límits del gest
  const PITCH_LIMIT = 1.5;                        // límit de setView (vista programada)
  const ZOOM_MIN = .8, ZOOM_MAX = 1.6;            // límits del zoom de la persona
  const SCALE_LIMIT = [.5, 2];                    // límits de setView
  const ACCENT = "#ffb91c", INK = "#28271d";
  const SEAM = .5;                                // px CSS d’expansió de cada quad
  const SHARP_DELAY = 140;                        // ms sense moviment abans del redibuix nítid
  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const fineQuery = matchMedia("(hover: hover) and (pointer: fine)");
  const whole = new Intl.NumberFormat("ca-ES", {useGrouping:"always", maximumFractionDigits:0});
  const oneDecimal = new Intl.NumberFormat("ca-ES", {minimumFractionDigits:1, maximumFractionDigits:1});
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- Vèrtexs ---------- */
  const vx = new Float32Array(NV), vy = new Float32Array(NV), vz = new Float32Array(NV);
  const zOf = h => (h - minH) * vertical / sideMetres;
  for (let i = 0; i < NV; i++) {
    vx[i] = ((i % n) - half) / C;
    vy[i] = (Math.floor(i / n) - half) / C;
    vz[i] = zOf(heights[i]);
  }
  // Vèrtex central: la ubicació publicada de la càmera inferior del Cap de Comella (FGC).
  const CENTRE = Math.floor(NV / 2);
  const px = new Float32Array(NV), py = new Float32Array(NV);   // projecció del darrer dibuix

  /* ---------- Paleta: pigment per alçada × ombra quantitzada ---------- */
  const TONES = 40, SHADES = 48, SHADE_LO = .3, SHADE_HI = 1.1;
  const low = [104,115,91], mid = [180,181,142], high = [238,216,151], glow = [255,196,70];
  const blend = (a, b, t) => a.map((c, i) => c + (b[i] - c) * t);
  const pigment = t => t < .52 ? blend(low, mid, t / .52) : blend(mid, high, (t - .52) / .48);
  const rgb = (p, k) => "rgb(" + p.map(c => Math.min(255, Math.round(c * k))).join(",") + ")";
  const palette = new Array(TONES * SHADES), accentPalette = new Array(TONES * SHADES);
  for (let ti = 0; ti < TONES; ti++) {
    const pig = pigment(ti / (TONES - 1)), acc = blend(pig, glow, .5);
    for (let si = 0; si < SHADES; si++) {
      const k = SHADE_LO + (SHADE_HI - SHADE_LO) * si / (SHADES - 1);
      palette[ti * SHADES + si] = rgb(pig, k);
      accentPalette[ti * SHADES + si] = rgb(acc, k);
    }
  }

  /* ---------- Cel·les i corbes de nivell ---------- */
  const cellI0 = new Uint16Array(NC), cellCx = new Float32Array(NC), cellCy = new Float32Array(NC);
  const slopeX = new Float32Array(NC), slopeY = new Float32Array(NC), invLen = new Float32Array(NC);
  const cellMean = new Float32Array(NC), cellTone = new Uint8Array(NC);
  const segStart = new Int32Array(NC + 1);
  const segs = [], segLevels = [];
  const levelSet = new Set();
  for (let row = 0, k = 0; row < C; row++) {
    for (let col = 0; col < C; col++, k++) {
      const i0 = row * n + col, ids = [i0, i0 + 1, i0 + n + 1, i0 + n];
      const z = ids.map(i => vz[i]), h = ids.map(i => heights[i]);
      cellI0[k] = i0;
      cellCx[k] = (col + .5 - half) / C;
      cellCy[k] = (row + .5 - half) / C;
      // Pendent per cel·la: la llum es calcula a cada fotograma a partir d’aquests dos valors.
      const sx = ((z[1] + z[2]) - (z[0] + z[3])) * C / 2;
      const sy = ((z[3] + z[2]) - (z[0] + z[1])) * C / 2;
      slopeX[k] = sx; slopeY[k] = sy; invLen[k] = 1 / Math.hypot(sx, sy, 1);
      const mean = (h[0] + h[1] + h[2] + h[3]) / 4;
      cellMean[k] = mean;
      cellTone[k] = Math.round((mean - minH) / (maxH - minH) * (TONES - 1));
      segStart[k] = segLevels.length;
      const lo = Math.min(...h), hi = Math.max(...h);
      for (let level = Math.ceil(lo / 100) * 100; level <= hi; level += 100) {
        const cuts = [];
        for (let e = 0; e < 4; e++) {
          const a = ids[e], b = ids[(e + 1) % 4], ha = heights[a], hb = heights[b];
          if ((ha < level) === (hb < level)) continue;
          const f = (level - ha) / (hb - ha);
          cuts.push(vx[a] + (vx[b] - vx[a]) * f, vy[a] + (vy[b] - vy[a]) * f);
        }
        const zl = zOf(level);
        for (let c = 3; c < cuts.length; c += 4) {
          segs.push(cuts[c - 3], cuts[c - 2], zl, cuts[c - 1], cuts[c], zl);
          segLevels.push(level / 100);
          levelSet.add(level / 100);
        }
      }
    }
  }
  segStart[NC] = segLevels.length;
  const segXYZ = Float32Array.from(segs), segLvl = Uint8Array.from(segLevels);
  // Índex per cota: quines cotes tenen corba (la sonda només ressalta cotes existents).
  const byLevel = new Map();
  segLvl.forEach((L, j) => { if (!byLevel.has(L)) byLevel.set(L, []); byLevel.get(L).push(j); });

  // Ordre de pintor (lluny → a prop). Es reordena a cada fotograma partint de l’anterior,
  // que ja és gairebé ordenat; el TimSort de V8 el resol en temps gairebé lineal.
  const order = new Uint16Array(NC).map((_, i) => i);
  const depthKey = new Float32Array(NC);
  const byDepth = (a, b) => depthKey[a] - depthKey[b];

  // Quatre parets laterals: vèrtexs de la vora (en ordre) i normal cap a fora.
  const sides = [
    {ids:Array.from({length:n}, (_, i) => i), nx:0, ny:-1},
    {ids:Array.from({length:n}, (_, i) => i * n + C), nx:1, ny:0},
    {ids:Array.from({length:n}, (_, i) => C * n + (C - i)), nx:0, ny:1},
    {ids:Array.from({length:n}, (_, i) => (C - i) * n), nx:-1, ny:0}
  ];

  /* ---------- Estat de la vista ---------- */
  // view: dibuixada. target: desitjada. El bucle interpola l’una cap a l’altra.
  const view = {yaw:DEFAULT.yaw, pitch:DEFAULT.pitch, scale:DEFAULT.scale, levelMax:Infinity};
  const target = {...view};
  let ready = false, visible = !("IntersectionObserver" in window), dirty = true;
  let frame = 0, lastMotion = 0, sharpTimer = 0, layout = null, orientation = NaN;
  const walls = [];                                // parets visibles del darrer dibuix (polígons en px CSS)
  let markerBox = null;                            // caixa de l’etiqueta del Cap de Comella (px CSS)

  /* ---------- Superfícies auxiliars: capa de sonda i brúixola ---------- */
  const stage = canvas.parentElement;
  const overlay = document.createElement("canvas");
  overlay.className = "terrain-overlay";
  overlay.setAttribute("aria-hidden", "true");
  const octx = overlay.getContext("2d");
  canvas.after(overlay);
  const compass = document.createElement("div");
  compass.className = "terrain-compass";
  compass.setAttribute("aria-hidden", "true");
  compass.innerHTML =
    '<svg viewBox="-6 -6 60 60" focusable="false"><g class="dial">' +
    '<circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" stroke-opacity=".8" vector-effect="non-scaling-stroke"/>' +
    '<path d="M24 6v4M42 24h-4M24 42v-4M6 24h4" stroke="currentColor" stroke-opacity=".7" vector-effect="non-scaling-stroke"/>' +
    '<path d="M24 24V9" stroke="' + ACCENT + '" stroke-width="1.6" vector-effect="non-scaling-stroke"/>' +
    '<circle cx="24" cy="24" r="1.6" fill="currentColor"/></g>' +
    '<text x="24" y="0" text-anchor="middle" dominant-baseline="central">N</text></svg>';
  stage.append(compass);
  const dial = compass.querySelector(".dial"), north = compass.querySelector("text");
  let compassKey = "";
  function paintCompass(s, c, sp) {
    const key = s.toFixed(3) + c.toFixed(3) + sp.toFixed(3);
    if (key === compassKey) return;
    compassKey = key;
    // El dial és un cercle sobre el terra: gira amb yaw i s’aplana amb la inclinació.
    dial.setAttribute("transform", "translate(24 24) scale(1 " + sp.toFixed(3) + ") rotate(" + (view.yaw * 180 / Math.PI).toFixed(2) + ") translate(-24 -24)");
    // La N va fora de l’el·lipse en espai de pantalla: punt del nord sobre l’anell (r = 18) i 8 px
    // més enllà en la mateixa direcció, perquè no toqui l’anell quan la vista obliqua l’aplana.
    const dx = s, dy = -c * sp, len = Math.hypot(dx, dy) || 1;
    north.setAttribute("x", (24 + 18 * dx + 8 * dx / len).toFixed(2));
    north.setAttribute("y", (24 + 18 * dy + 8 * dy / len).toFixed(2));
  }

  /* ---------- Lectura de la sonda (només visual, sense aria-live) ---------- */
  const readout = document.getElementById("terrain-readout");
  const status = readout && readout.parentElement && readout.parentElement.classList.contains("terrain-status") ? readout.parentElement : null;
  const probeLine = status ? status.querySelector(".terrain-probe") : null;
  const INSTRUCTION = "Arrossega per girar i inclinar el relleu.";
  // Anunci per a lector de pantalla només després d’accions deliberades (tecles i botons).
  const live = document.createElement("p");
  live.className = "sr-only";
  live.setAttribute("aria-live", "polite");
  (canvas.closest(".terrain-panel") || stage).append(live);

  /* ---------- Dibuix ---------- */
  const dprHi = () => Math.min(2, window.devicePixelRatio || 1);
  // En moviment, DPR 1,5; si l’equip no hi arriba (tres fotogrames en moviment de més de 8 ms),
  // baixa a 1,25 per a la resta de la visita. El dibuix nítid en aturar-se no canvia.
  const MOVING_BUDGET = 8;
  let dprMoving = 1.5, slowFrames = 0;
  const dprLo = () => Math.min(dprMoving, dprHi());
  function requestDraw() { if (!frame) frame = requestAnimationFrame(draw); }
  function markMotion() { lastMotion = performance.now(); }

  function draw() {
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    if (!ready) return;
    if (!visible) { dirty = true; return; }
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    dirty = false;
    const t0 = performance.now();
    const moving = !!loop || t0 - lastMotion < SHARP_DELAY;
    const dpr = moving ? dprLo() : dprHi();
    const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    ctx.setTransform(bw / w, 0, 0, bh / h, 0, 0);
    ctx.fillStyle = "#181e19"; ctx.fillRect(0, 0, w, h);

    const {yaw, pitch, scale, levelMax} = view;
    const c = Math.cos(yaw), s = Math.sin(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
    const k = Math.min(w * .64, h * .97) * scale;
    // Enquadrament vertical: el bloc (superfície i base) queda centrat.
    let top = Infinity, bottom = -Infinity;
    for (let i = 0; i < NV; i++) {
      const d = (vx[i] * s + vy[i] * c) * sp;
      const yt = d - vz[i] * cp, yb = d - base * cp;
      if (yt < top) top = yt;
      if (yb > bottom) bottom = yb;
    }
    const ox = w / 2, oy = (h - k * (bottom + top)) / 2 + 6;
    for (let i = 0; i < NV; i++) {
      px[i] = ox + (vx[i] * c - vy[i] * s) * k;
      py[i] = oy + ((vx[i] * s + vy[i] * c) * sp - vz[i] * cp) * k;
    }
    layout = {ox, oy, k, c, s, sp, cp, w, h};
    const gx = (x, y) => ox + (x * c - y * s) * k;
    const gy = (x, y, z) => oy + ((x * s + y * c) * sp - z * cp) * k;

    // Retícula del terra: dona l’orientació mentre la vista gira.
    ctx.lineWidth = .6; ctx.strokeStyle = "#3a4338"; ctx.beginPath();
    for (let q = -4; q <= 4; q++) {
      const d = q / 6;
      ctx.moveTo(gx(-.67, d), gy(-.67, d, base)); ctx.lineTo(gx(.67, d), gy(.67, d, base));
      ctx.moveTo(gx(d, -.67), gy(d, -.67, base)); ctx.lineTo(gx(d, .67), gy(d, .67, base));
    }
    ctx.stroke();

    // Llum fixa respecte de l’observador: a la vista per defecte coincideix amb la llum original.
    const c0 = Math.cos(DEFAULT.yaw), s0 = Math.sin(DEFAULT.yaw);
    const lu = .43 * c0 - .7 * s0, ld = .43 * s0 + .7 * c0;
    const ax = c * lu + s * ld, ay = -s * lu + c * ld, az = .65;
    const alen = Math.hypot(ax, ay) || 1;

    // Parets: només les dues (o una) que miren cap a l’observador. Una paret visible tapa tot el
    // que té darrere, així que el polígon es calcula ara (la sonda l’ha de conèixer) i es pinta
    // després de les cel·les i les corbes.
    walls.length = 0;
    for (const side of sides) {
      if (side.nx * s + side.ny * c <= 0) continue;
      const ids = side.ids, a = ids[0], b = ids[ids.length - 1], poly = new Float32Array(ids.length * 2 + 4);
      for (let q = 0; q < ids.length; q++) { poly[q * 2] = px[ids[q]]; poly[q * 2 + 1] = py[ids[q]]; }
      const e = ids.length * 2;
      poly[e] = gx(vx[b], vy[b]); poly[e + 1] = gy(vx[b], vy[b], base);
      poly[e + 2] = gx(vx[a], vy[a]); poly[e + 3] = gy(vx[a], vy[a], base);
      walls.push({poly, f:.8 - .2 * (side.nx * ax + side.ny * ay) / alen});
    }

    for (let q = 0; q < NC; q++) depthKey[q] = cellCx[q] * s + cellCy[q] * c;
    order.sort(byDepth);

    // La sonda es resol amb la projecció d’aquest fotograma, abans de pintar les corbes.
    pick();
    const probeL = probe ? probe.level : -1;
    const banded = Number.isFinite(levelMax);
    const frontL = banded ? Math.floor(levelMax / 100) : -1;
    const bandLo = levelMax - 100;
    const contourWidth = w < 440 ? .75 : 1.05;
    const contourInk = "rgba(75,53,18,.75)";
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = contourInk; ctx.lineWidth = contourWidth;
    let lastFill = "";
    for (let q = 0; q < NC; q++) {
      const cell = order[q], i0 = cellI0[cell], i1 = i0 + 1, i2 = i0 + n + 1, i3 = i0 + n;
      let x0 = px[i0], y0 = py[i0], x1 = px[i1], y1 = py[i1], x2 = px[i2], y2 = py[i2], x3 = px[i3], y3 = py[i3];
      // Sense traç per quad: cada quad s’expandeix mig píxel des del centroide per tapar les juntes.
      const mx = (x0 + x1 + x2 + x3) * .25, my = (y0 + y1 + y2 + y3) * .25;
      let dx = x0 - mx, dy = y0 - my, d = Math.sqrt(dx * dx + dy * dy); if (d > 0) { d = SEAM / d; x0 += dx * d; y0 += dy * d; }
      dx = x1 - mx; dy = y1 - my; d = Math.sqrt(dx * dx + dy * dy); if (d > 0) { d = SEAM / d; x1 += dx * d; y1 += dy * d; }
      dx = x2 - mx; dy = y2 - my; d = Math.sqrt(dx * dx + dy * dy); if (d > 0) { d = SEAM / d; x2 += dx * d; y2 += dy * d; }
      dx = x3 - mx; dy = y3 - my; d = Math.sqrt(dx * dx + dy * dy); if (d > 0) { d = SEAM / d; x3 += dx * d; y3 += dy * d; }
      const lit = (ax * slopeX[cell] + ay * slopeY[cell] + az) * invLen[cell];
      const si = clamp(Math.round((.71 + .34 * lit - SHADE_LO) / (SHADE_HI - SHADE_LO) * (SHADES - 1)), 0, SHADES - 1);
      const mean = cellMean[cell];
      const fill = (banded && mean > bandLo && mean <= levelMax ? accentPalette : palette)[cellTone[cell] * SHADES + si];
      if (fill !== lastFill) { ctx.fillStyle = fill; lastFill = fill; }
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill();

      const j0 = segStart[cell], j1 = segStart[cell + 1];
      if (j1 === j0) continue;
      let plain = false, accent = false;
      ctx.beginPath();
      for (let j = j0; j < j1; j++) {
        const L = segLvl[j];
        if (L * 100 > levelMax) continue;
        if (L === probeL || L === frontL) { accent = true; continue; }
        const o = j * 6;
        ctx.moveTo(gx(segXYZ[o], segXYZ[o + 1]), gy(segXYZ[o], segXYZ[o + 1], segXYZ[o + 2]));
        ctx.lineTo(gx(segXYZ[o + 3], segXYZ[o + 4]), gy(segXYZ[o + 3], segXYZ[o + 4], segXYZ[o + 5]));
        plain = true;
      }
      if (plain) ctx.stroke();
      if (accent) {
        ctx.beginPath();
        for (let j = j0; j < j1; j++) {
          const L = segLvl[j];
          if (L * 100 > levelMax || (L !== probeL && L !== frontL)) continue;
          const o = j * 6;
          ctx.moveTo(gx(segXYZ[o], segXYZ[o + 1]), gy(segXYZ[o], segXYZ[o + 1], segXYZ[o + 2]));
          ctx.lineTo(gx(segXYZ[o + 3], segXYZ[o + 4]), gy(segXYZ[o + 3], segXYZ[o + 4], segXYZ[o + 5]));
        }
        // Filet fosc a sota perquè el groc es llegeixi també sobre les cotes altes, que són clares.
        ctx.strokeStyle = INK; ctx.lineWidth = contourWidth + 2; ctx.stroke();
        ctx.strokeStyle = ACCENT; ctx.lineWidth = contourWidth + .7; ctx.stroke();
        ctx.strokeStyle = contourInk; ctx.lineWidth = contourWidth;
      }
    }

    for (const wall of walls) {
      const p = wall.poly;
      ctx.fillStyle = rgb([125,118,81], wall.f);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]);
      for (let q = 2; q < p.length; q += 2) ctx.lineTo(p[q], p[q + 1]);
      ctx.closePath(); ctx.fill();
    }

    // Punt de referència: càmera inferior del Cap de Comella.
    const mxp = px[CENTRE], myp = py[CENTRE];
    ctx.fillStyle = ACCENT; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mxp, myp, 4, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    ctx.font = "bold 11px Lab, Arial, sans-serif";
    const title = "Cap de Comella inferior", tw = ctx.measureText(title).width;
    const lx = Math.max(4, Math.min(w - tw - 14, mxp + 14)), ly = Math.max(20, myp - 34);
    ctx.beginPath(); ctx.moveTo(mxp, myp - 4); ctx.lineTo(mxp, ly); ctx.lineTo(lx, ly);
    ctx.strokeStyle = "#ffca55"; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = "#1e261f"; ctx.fillRect(lx - 2, ly - 11, tw + 12, 19);
    markerBox = {x:lx - 2, y:ly - 11, w:tw + 12, h:19};
    ctx.fillStyle = "#ffe3a3"; ctx.fillText(title, lx + 3, ly + 2);

    paintCompass(s, c, sp);
    const deg = Math.round(yaw * 180 / Math.PI);
    if (deg !== orientation) { orientation = deg; canvas.dataset.orientation = String(deg); }
    drawOverlay();
    publishProbe();
    if (moving) {
      if (dprMoving > 1.25 && performance.now() - t0 > MOVING_BUDGET && ++slowFrames >= 3) dprMoving = 1.25;
      clearTimeout(sharpTimer);
      sharpTimer = setTimeout(() => { if (!loop) requestDraw(); }, SHARP_DELAY + 20);
    }
  }

  /* ---------- Sonda d’altitud ---------- */
  // El punter es desa en coordenades de client i es converteix en cada lectura: el canvas es pot
  // desplaçar sota un ratolí quiet sense que arribi cap pointermove ni pointerleave.
  let pointer = null, probe = null, probeFrame = 0, published = "", overlayClean = true;
  function pick() {
    probe = null;
    if (!pointer || drag) return;
    const r = canvas.getBoundingClientRect();
    const X = pointer.cx - r.left, Y = pointer.cy - r.top;
    if (X < 0 || Y < 0 || X > r.width || Y > r.height) return;
    // Una paret visible tapa el relleu que té darrere.
    for (const wall of walls) if (inside(X, Y, wall.poly)) return;
    // De davant cap enrere: el primer quad que conté el punter és el visible.
    for (let q = NC - 1; q >= 0; q--) {
      const cell = order[q], i0 = cellI0[cell], i1 = i0 + 1, i2 = i0 + n + 1, i3 = i0 + n;
      const x0 = px[i0], y0 = py[i0], x1 = px[i1], y1 = py[i1], x2 = px[i2], y2 = py[i2], x3 = px[i3], y3 = py[i3];
      if (X < Math.min(x0, x1, x2, x3) || X > Math.max(x0, x1, x2, x3) || Y < Math.min(y0, y1, y2, y3) || Y > Math.max(y0, y1, y2, y3)) continue;
      // Dos triangles: (0,1,2) → u = b+g, v = g; (0,2,3) → u = b, v = b+g.
      let uv = bary(X, Y, x0, y0, x1, y1, x2, y2), u, v;
      if (uv) { u = uv[0] + uv[1]; v = uv[1]; }
      else { uv = bary(X, Y, x0, y0, x2, y2, x3, y3); if (!uv) continue; u = uv[0]; v = uv[0] + uv[1]; }
      u = clamp(u, 0, 1); v = clamp(v, 0, 1);
      const elevation = heights[i0] * (1 - u) * (1 - v) + heights[i1] * u * (1 - v) + heights[i2] * u * v + heights[i3] * (1 - u) * v;
      const wx = vx[i0] + u / C, wy = vy[i0] + v / C;
      const near = Math.round(elevation / 100);
      probe = {x:X, y:Y, elevation, distance:Math.hypot(wx, wy) * sideMetres, level:byLevel.has(near) ? near : -1};
      return;
    }
  }
  function bary(X, Y, ax, ay, bx, by, cx, cy) {
    const v0x = bx - ax, v0y = by - ay, v1x = cx - ax, v1y = cy - ay, v2x = X - ax, v2y = Y - ay;
    const den = v0x * v1y - v1x * v0y;
    if (Math.abs(den) < 1e-6) return null;
    const b = (v2x * v1y - v1x * v2y) / den, g = (v0x * v2y - v2x * v0y) / den;
    return b >= -1e-4 && g >= -1e-4 && b + g <= 1.0001 ? [b, g] : null;
  }
  function inside(X, Y, p) {
    // Raig horitzontal (paritat de creuaments) sobre el polígon [x0,y0,x1,y1,…].
    let hit = false;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      const yi = p[i + 1], yj = p[j + 1];
      if ((yi > Y) !== (yj > Y) && X < (p[j] - p[i]) * (Y - yi) / (yj - yi) + p[i]) hit = !hit;
    }
    return hit;
  }
  function drawOverlay() {
    const w = canvas.clientWidth, h = canvas.clientHeight, dpr = dprHi();
    const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    // Canviar la mida buida el canvas: després queda net.
    if (overlay.width !== bw || overlay.height !== bh) { overlay.width = bw; overlay.height = bh; overlayClean = true; }
    if (!probe) {
      if (!overlayClean) { octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, bw, bh); overlayClean = true; }
      return;
    }
    octx.setTransform(bw / (w || 1), 0, 0, bh / (h || 1), 0, 0);
    octx.clearRect(0, 0, w, h);
    overlayClean = false;
    const {x, y} = probe;
    octx.strokeStyle = "#fff8e6"; octx.lineWidth = 1;
    octx.beginPath();
    octx.moveTo(x - 13, y); octx.lineTo(x - 4, y); octx.moveTo(x + 4, y); octx.lineTo(x + 13, y);
    octx.moveTo(x, y - 13); octx.lineTo(x, y - 4); octx.moveTo(x, y + 4); octx.lineTo(x, y + 13);
    octx.stroke();
    octx.fillStyle = ACCENT; octx.beginPath(); octx.arc(x, y, 1.6, 0, 2 * Math.PI); octx.fill();
    const label = whole.format(Math.round(probe.elevation)) + " m";
    octx.font = "bold 11px Lab, Arial, sans-serif";
    const tw = octx.measureText(label).width + 12, TH = 19;
    // Etiqueta de la sonda: dalt a la dreta si hi cap; si no, la primera posició dins del relleu
    // que no tapi l’etiqueta fixa del Cap de Comella inferior.
    const fits = (tx, ty) => tx >= 4 && ty >= 4 && tx + tw <= w - 4 && ty + TH <= h - 4;
    const clear = (tx, ty) => !markerBox ||
      tx > markerBox.x + markerBox.w + 3 || tx + tw < markerBox.x - 3 ||
      ty > markerBox.y + markerBox.h + 3 || ty + TH < markerBox.y - 3;
    const spots = [[x + 14, y - 30], [x - 14 - tw, y - 30], [x + 14, y + 14], [x - 14 - tw, y + 14]];
    const inBounds = spots.filter(p => fits(p[0], p[1]));
    const [tx, ty] = inBounds.find(p => clear(p[0], p[1])) || inBounds[0] || spots[0];
    octx.fillStyle = ACCENT; octx.fillRect(tx, ty, tw, 19);
    // Filet fosc, com el de les corbes ressaltades: la vora no es perd sobre la corba groga.
    octx.strokeStyle = INK; octx.lineWidth = 1; octx.strokeRect(tx + .5, ty + .5, tw - 1, 18);
    octx.fillStyle = "#121512"; octx.fillText(label, tx + 6, ty + 13);
  }
  function distanceText(d) {
    // Referència: el punt groc, la càmera del Cap de Comella inferior (FONTS.md).
    if (d < 50) return "al Cap de Comella inferior";
    if (d < 1000) return "a " + whole.format(Math.round(d / 10) * 10) + " m del Cap de Comella inferior";
    return "a " + oneDecimal.format(d / 1000) + " km del Cap de Comella inferior";
  }
  const probeListeners = [];
  function publishProbe() {
    const text = probe ? "Cota " + whole.format(Math.round(probe.elevation)) + " m · " + distanceText(probe.distance) : "";
    if (text === published) return;
    published = text;
    if (probeLine) {
      if (text) probeLine.textContent = text;
      status.classList.toggle("is-probing", !!text);
    }
    const info = probe ? {elevation:probe.elevation, distance:probe.distance} : null;
    for (const cb of probeListeners) { try { cb(info); } catch (e) { console.error(e); } }
  }
  function updateProbe() {
    probeFrame = 0;
    // Un dibuix pendent o el bucle amorteit (que dibuixa a cada fotograma) ja recalculen la sonda.
    if (frame || loop || !layout || !visible) return;
    const before = probe ? probe.level : -1;
    pick();
    if ((probe ? probe.level : -1) !== before) { draw(); return; }
    drawOverlay(); publishProbe();
  }
  function requestProbe() { if (!probeFrame) probeFrame = requestAnimationFrame(updateProbe); }
  function hover(e) {
    if (!fineQuery.matches || e.pointerType !== "mouse" || drag) return;
    pointer = {cx:e.clientX, cy:e.clientY};
    requestProbe();
  }
  function clearProbe() {
    pointer = null;
    if (!probe) return;
    const hadLevel = probe.level >= 0;
    probe = null;
    if (hadLevel) requestDraw(); else { drawOverlay(); publishProbe(); }
  }

  /* ---------- Bucle amorteit ---------- */
  // Inèrcia màxima ≈ 0,06/(1-0,9) rad ≈ 34°: prou per sentir l’impuls sense perdre l’orientació.
  const LERP = .12, EPS = 1e-4, FRICTION = .9;
  let loop = 0, last = 0;
  const spin = {yaw:0, pitch:0};
  function settle() {
    Object.assign(view, target);
    spin.yaw = spin.pitch = 0;
    if (loop) { cancelAnimationFrame(loop); loop = 0; }
    markMotion();
    requestDraw();
  }
  function step(now) {
    loop = 0;
    if (!visible) { settle(); return; }
    const dt = last ? Math.min(64, now - last) : 16.67; last = now;
    const k = dt / 16.67;
    if (spin.yaw || spin.pitch) {
      target.yaw += spin.yaw * k;
      target.pitch = clamp(target.pitch + spin.pitch * k, PITCH_MIN, PITCH_MAX);
      const decay = Math.pow(FRICTION, k);
      spin.yaw *= decay; spin.pitch *= decay;
      if (Math.abs(spin.yaw) < EPS) spin.yaw = 0;
      if (Math.abs(spin.pitch) < EPS || target.pitch === PITCH_MIN || target.pitch === PITCH_MAX) spin.pitch = 0;
    }
    const a = 1 - Math.pow(1 - LERP, k);
    view.yaw += (target.yaw - view.yaw) * a;
    view.pitch += (target.pitch - view.pitch) * a;
    view.scale += (target.scale - view.scale) * a;
    if (Number.isFinite(target.levelMax) && Number.isFinite(view.levelMax)) view.levelMax += (target.levelMax - view.levelMax) * a;
    else view.levelMax = target.levelMax;
    const settled = !spin.yaw && !spin.pitch &&
      Math.abs(target.yaw - view.yaw) < EPS && Math.abs(target.pitch - view.pitch) < EPS &&
      Math.abs(target.scale - view.scale) < EPS && (!Number.isFinite(view.levelMax) || Math.abs(target.levelMax - view.levelMax) < .5);
    if (settled) { Object.assign(view, target); last = 0; }
    else loop = requestAnimationFrame(step);
    markMotion();
    if (ready) draw();
  }
  function animate() {
    if (reducedQuery.matches) { settle(); return; }
    if (!loop) { last = 0; loop = requestAnimationFrame(step); }
  }

  /* ---------- Entrada de la persona ---------- */
  const inputListeners = [];
  function userInput(type) { for (const cb of inputListeners) { try { cb(type); } catch (e) { console.error(e); } } }
  const DIRECTIONS = ["al nord","al nord-est","a l’est","al sud-est","al sud","al sud-oest","a l’oest","al nord-oest"];
  function heading() {
    // Direcció cap on mira la càmera: (est, nord) = (−sin yaw, cos yaw).
    const deg = (Math.atan2(-Math.sin(target.yaw), Math.cos(target.yaw)) * 180 / Math.PI + 360) % 360;
    return DIRECTIONS[Math.round(deg / 45) % 8];
  }
  let announceTimer = 0;
  function announce() {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      const text = "Vista cap " + heading() + ".";
      if (readout) readout.textContent = text + " " + INSTRUCTION;
      live.textContent = text;
    }, 600);
  }
  function turn(delta) { spin.yaw = spin.pitch = 0; target.yaw += delta; animate(); }
  function tilt(delta) { spin.yaw = spin.pitch = 0; target.pitch = clamp(target.pitch + delta, PITCH_MIN, PITCH_MAX); animate(); }
  function zoomBy(f) { target.scale = clamp(target.scale * f, ZOOM_MIN, ZOOM_MAX); animate(); }
  function reset() {
    spin.yaw = spin.pitch = 0;
    // Torna per la volta més curta, encara que s’hagi girat diverses vegades.
    const turns = Math.round((target.yaw - DEFAULT.yaw) / (2 * Math.PI));
    target.yaw = DEFAULT.yaw + turns * 2 * Math.PI; target.pitch = DEFAULT.pitch; target.scale = DEFAULT.scale;
    target.levelMax = Infinity;
    animate();
  }

  let drag = null;
  canvas.addEventListener("pointerdown", e => {
    if (!e.isPrimary || e.button !== 0) return;
    // Un clic amb el ratolí mai activa el zoom amb la roda (només el focus de teclat).
    wheelZoom = false;
    canvas.removeAttribute("data-lenis-prevent-wheel");
    spin.yaw = spin.pitch = 0;
    // El gest només es reclama (i el scroll deixa de governar la càmera) quan el punter es mou.
    drag = {id:e.pointerId, x:e.clientX, y:e.clientY, claimed:false, touch:e.pointerType === "touch", samples:[{x:e.clientX, y:e.clientY, t:e.timeStamp}]};
    canvas.setPointerCapture(e.pointerId);
    clearProbe();
  });
  canvas.addEventListener("pointermove", e => {
    if (!drag) { hover(e); return; }
    if (e.pointerId !== drag.id) return;
    if (!drag.claimed) {
      // Amb el dit, només el moviment horitzontal: el vertical és scroll de pàgina (touch-action: pan-y).
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if ((drag.touch ? Math.abs(dx) : Math.hypot(dx, dy)) <= 4) return;
      drag.claimed = true;
      userInput("drag");
      // Base del gest al punt de reclamació: la vista no salta els primers píxels.
      drag.x = e.clientX; drag.y = e.clientY;
      drag.yaw = target.yaw; drag.pitch = clamp(target.pitch, PITCH_MIN, PITCH_MAX);
      drag.samples = [];
    }
    target.yaw = drag.yaw + (e.clientX - drag.x) * .009;
    if (!drag.touch) target.pitch = clamp(drag.pitch + (e.clientY - drag.y) * .004, PITCH_MIN, PITCH_MAX);
    drag.samples.push({x:e.clientX, y:e.clientY, t:e.timeStamp});
    if (drag.samples.length > 6) drag.samples.shift();
    animate();
  });
  canvas.addEventListener("pointerleave", clearProbe);
  function release(e) {
    if (!drag || (e.pointerId !== undefined && e.pointerId !== drag.id)) return;
    const d = drag; drag = null;
    if (!d.claimed) return;                // un clic sense moviment no toca la vista
    if (e.type === "pointerup" && !reducedQuery.matches) {
      // Inèrcia a partir de la velocitat dels darrers ~100 ms del gest.
      const recent = d.samples.filter(p => e.timeStamp - p.t < 100);
      if (recent.length > 1) {
        const a = recent[0], b = recent[recent.length - 1], dt = Math.max(1, b.t - a.t);
        const sx = (b.x - a.x) / dt, sy = (b.y - a.y) / dt;
        spin.yaw = clamp(sx * .009 * 16.67 * .6, -.06, .06);
        spin.pitch = d.touch ? 0 : clamp(sy * .004 * 16.67 * .6, -.03, .03);
      }
    }
    animate();
  }
  for (const type of ["pointerup","pointercancel","lostpointercapture"]) canvas.addEventListener(type, release);

  const button = (id, fn) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener("click", () => { userInput("button"); fn(); announce(); });
  };
  button("gira-esquerra", () => turn(-Math.PI / 9));
  button("gira-dreta", () => turn(Math.PI / 9));
  button("inclina-amunt", () => tilt(.12));
  button("inclina-avall", () => tilt(-.12));
  button("apropa", () => zoomBy(1.15));
  button("allunya", () => zoomBy(1 / 1.15));
  button("restableix", reset);

  const KEYS = ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","+","=","-","_"];
  canvas.addEventListener("keydown", e => {
    if (!KEYS.includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    userInput("key");
    if (e.key === "Home") reset();
    else if (e.key === "ArrowLeft") turn(-Math.PI / 12);
    else if (e.key === "ArrowRight") turn(Math.PI / 12);
    else if (e.key === "ArrowUp") tilt(.08);
    else if (e.key === "ArrowDown") tilt(-.08);
    else zoomBy(e.key === "+" || e.key === "=" ? 1.15 : 1 / 1.15);
    announce();
  });

  // La roda només fa zoom amb intenció explícita: focus de teclat al canvas (amb anell visible) o
  // pessic / Ctrl+roda. Amb el focus del ratolí, i en arribar al límit de zoom, la pàgina es desplaça.
  // Lenis ignora la roda als elements amb data-lenis-prevent-wheel (i ja ignora les rodes amb Ctrl).
  let wheelZoom = false;
  const keyboardFocus = () => { try { return canvas.matches(":focus-visible"); } catch (err) { return false; } };
  canvas.addEventListener("focus", () => {
    wheelZoom = keyboardFocus();
    if (wheelZoom) canvas.setAttribute("data-lenis-prevent-wheel", "");
  });
  canvas.addEventListener("blur", () => { wheelZoom = false; canvas.removeAttribute("data-lenis-prevent-wheel"); });
  canvas.addEventListener("wheel", e => {
    const kb = wheelZoom && document.activeElement === canvas;
    if (!kb && !e.ctrlKey) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    if (!dy) return;
    const f = Math.exp(-clamp(dy, -120, 120) * .0016);
    if (clamp(target.scale * f, ZOOM_MIN, ZOOM_MAX) === target.scale) {
      // Al límit en aquesta direcció: la roda torna a la pàgina (Lenis la veu sense l’atribut).
      canvas.removeAttribute("data-lenis-prevent-wheel");
      return;
    }
    if (kb) canvas.setAttribute("data-lenis-prevent-wheel", "");
    e.preventDefault();
    userInput("zoom");
    zoomBy(f);
  }, {passive:false});

  /* ---------- API ---------- */
  function setView(v, o) {
    v = v || {}; o = o || {};
    if (Number.isFinite(v.yaw)) target.yaw = v.yaw;
    if (Number.isFinite(v.pitch)) target.pitch = clamp(v.pitch, PITCH_MIN, PITCH_LIMIT);
    if (Number.isFinite(v.scale)) target.scale = clamp(v.scale, SCALE_LIMIT[0], SCALE_LIMIT[1]);
    if (typeof v.levelMax === "number" && !Number.isNaN(v.levelMax)) target.levelMax = v.levelMax;
    spin.yaw = spin.pitch = 0;
    if (o.immediate || reducedQuery.matches) settle();
    else animate();
  }
  let resolveReady;
  const api = LINE.terreny = {
    ready: new Promise(r => { resolveReady = r; }),
    setView,
    getView: () => ({...view}),
    onProbe: cb => { if (typeof cb === "function") probeListeners.push(cb); },
    onUserInput: cb => { if (typeof cb === "function") inputListeners.push(cb); }
  };

  if (readout) readout.textContent = INSTRUCTION;
  new ResizeObserver(() => { markMotion(); requestDraw(); }).observe(canvas);
  // Fora del pin la vista no es redibuixa mentre la pàgina es desplaça: amb un ratolí quiet sobre
  // el relleu, la sonda es rellegeix a cada actualització de ScrollTrigger (sense listener de scroll).
  const motion = LINE.motion;
  if (motion && typeof motion.onReady === "function") {
    motion.onReady(() => {
      if (!window.ScrollTrigger) return;
      window.ScrollTrigger.create({start:0, end:"max", onUpdate: () => { if (pointer && visible) requestProbe(); }});
    });
  }
  if (!visible) {
    new IntersectionObserver(entries => {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible && dirty) requestDraw();
    }, {rootMargin:"100px 0px"}).observe(canvas);
  }
  // Primer dibuix amb la Lab carregada, perquè les etiquetes del canvas no surtin amb la font de reserva.
  const fontsReady = document.fonts
    ? Promise.all([document.fonts.ready, document.fonts.load("bold 11px Lab")]).catch(() => {})
    : Promise.resolve();
  Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))]).then(() => {
    ready = true;
    requestDraw();
    resolveReady(api);
  });
})();
