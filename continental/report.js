"use strict";
const edition = window.EDICIO_CONTINENTAL;
const el = id => document.getElementById(id);
const number = new Intl.NumberFormat("ca-ES",{useGrouping:"always",maximumFractionDigits:1});
const display = n => Number.isFinite(n) ? number.format(n) : "Pendent";
const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)");
const chartMetrics = {
  visites: {name:"Visites", unit:"visites", title:"Afluència a pistes"},
  obertura: {name:"Obertura", unit:"dies", title:"Dies d’obertura"}
};
function node(tag, text, className) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
}

/* ---------- Xifres de temporada (darrer tall) ---------- */
function seasonKpis() {
  const box = el("kpis"), last = edition.periodes[edition.periodes.length-1];
  if (!last) { box.hidden = true; return; }
  const items = [
    ["Visites de temporada", last.visites && last.visites.temporada, 0, ""],
    ["Dies oberts de temporada", last.obertura && last.obertura.temporada, 0, ""],
    ["Km esquiables al tall", last.kmAlTall, 1, " km"],
    ["Pistes obertes al tall", last.pistesAlTall, 0, ""]
  ];
  const list = node("dl", undefined, "kpi-grid");
  for (const [label, value, decimals, suffix] of items) {
    const item = node("div", undefined, "kpi"), dd = node("dd");
    const fmt = new Intl.NumberFormat("ca-ES",{useGrouping:"always",minimumFractionDigits:decimals,maximumFractionDigits:decimals});
    const out = node("span", Number.isFinite(value) ? fmt.format(value)+suffix : "Pendent", "kpi-value");
    // El fitxer de moviment llegeix aquests valors per fer el comptador.
    out.dataset.value = Number.isFinite(value) ? String(value) : "";
    out.dataset.decimals = String(decimals);
    out.dataset.suffix = suffix;
    dd.append(out); item.append(node("dt", label), dd); list.append(item);
  }
  box.append(node("p", "Tall: "+last.tall, "kpi-cut"), list);
}

/* ---------- Gràfic per quinzena ---------- */
let selectedMetric = "visites";
let selectedPeriod = Math.max(0,edition.periodes.length-1);
const periodButtons = [];
const bars = [];
// Les barres creixen quan el gràfic entra a la vista (sense moviment reduït).
let plotShown = prefersReduced.matches || !("IntersectionObserver" in window);

function selectPeriod(i, announce) {
  selectedPeriod = i;
  const metric = chartMetrics[selectedMetric], period = edition.periodes[i];
  periodButtons.forEach((b,index) => b.setAttribute("aria-pressed",String(i===index)));
  const v = period[selectedMetric];
  const text = display(v.quinzena)+" "+metric.unit+" a la quinzena · "+display(v.temporada)+" "+metric.unit+" de temporada";
  el("read-value").replaceChildren(node("strong",period.nom+" · "),document.createTextNode(text));
  // Només el clic i el canvi d’indicador s’anuncien: amb el focus, el nom accessible de la barra ja diu el mateix.
  if (announce) el("read-live").textContent = period.nom+" · "+text;
}
function metricButtons() {
  for (const [key,metric] of Object.entries(chartMetrics)) {
    const b = node("button",metric.name);
    b.type="button"; b.dataset.metric = key;
    b.addEventListener("click",() => {
      if (selectedMetric === key) return;
      selectedMetric=key; renderChart(true);
    });
    el("metrics").append(b);
  }
}
function buildBars() {
  const plot = el("plot");
  edition.periodes.forEach((period,i) => {
    const b = node("button",undefined,"period-bar");
    b.type = "button";
    const head = node("span",undefined,"bar-head"), value = node("strong");
    // L’espai no es pinta (flex), però separa nom i xifra al text de la barra que comparen les eines d’accessibilitat.
    head.append(node("span",period.nom)," ",value);
    const track = node("span",undefined,"track");
    track.setAttribute("aria-hidden","true");
    const season = node("span",undefined,"fill temporada"), fortnight = node("span",undefined,"fill quinzena");
    season.style.setProperty("--i",i); fortnight.style.setProperty("--i",i);
    track.append(season,fortnight);
    b.append(head,track);
    // Hit area covers the full row so either bar is readable on touch and with a pointer.
    b.addEventListener("pointerenter",e => {if(e.pointerType==="mouse")selectPeriod(i,false)});
    b.addEventListener("focus",() => selectPeriod(i,false));
    b.addEventListener("click",() => selectPeriod(i,true));
    b.addEventListener("keydown",event => {
      if (!["ArrowLeft","ArrowRight","ArrowDown","ArrowUp","Home","End"].includes(event.key)) return;
      event.preventDefault();
      const last=periodButtons.length-1;
      let index=i;
      if(event.key==="Home") index=0;
      else if(event.key==="End") index=last;
      else index=Math.max(0,Math.min(last,i+(["ArrowRight","ArrowDown"].includes(event.key) ? 1 : -1)));
      // El focus ja selecciona la barra; el lector llegeix el seu nom accessible.
      if (index === i) selectPeriod(index,false); else periodButtons[index].focus();
    });
    periodButtons.push(b); bars.push({button:b,value,season,fortnight,target:null});
    plot.append(b);
  });
}
// translateX es mesura sobre l’amplada pròpia del tram (100 % de la pista).
const barTransform = (left,width) => "translateX("+(left*100)+"%) scaleX("+width+")";
function paintBars() {
  for (const bar of bars) {
    const t = bar.target;
    if (!t) continue;
    bar.season.style.transform = plotShown ? barTransform(0,t.season) : barTransform(0,0);
    bar.fortnight.style.transform = plotShown ? barTransform(t.left,t.fortnight) : barTransform(t.left,0);
  }
}
function setCount(strong, value, unit, animate) {
  const finalText = display(value)+" "+unit;
  // Si canvia la mètrica (unitat), el comptador arrenca de 0: mai xifres d’una mètrica amb la unitat d’una altra.
  const sameUnit = strong.dataset.unit === unit;
  const stored = strong.dataset.value === "" || strong.dataset.value === undefined ? NaN : Number(strong.dataset.value);
  const previous = sameUnit ? stored : 0;
  strong.dataset.value = Number.isFinite(value) ? String(value) : "";
  strong.dataset.unit = unit;
  const M = window.LINE && window.LINE.motion;
  if (strong._tween) { strong._tween.kill(); strong._tween = null; }
  if (!animate || !M || !M.enabled || !window.gsap || !Number.isFinite(value) || !Number.isFinite(previous)) {
    strong.textContent = finalText; return;
  }
  const state = {v:previous}, whole = Number.isInteger(value);
  strong._tween = window.gsap.to(state,{
    v:value, duration:M.dur.d4, ease:M.ease.out,
    onUpdate:() => { strong.textContent = number.format(whole ? Math.round(state.v) : state.v)+" "+unit; },
    onComplete:() => { strong.textContent = finalText; strong._tween = null; }
  });
}
function renderChart(animate) {
  const metric = chartMetrics[selectedMetric];
  el("chart-title").textContent = metric.title;
  el("chart-sub").textContent = "La barra sencera indica l’acumulat de temporada. El tram groc final és la quinzena.";
  for (const b of el("metrics").children) b.setAttribute("aria-pressed",String(b.dataset.metric===selectedMetric));
  if (!bars.length) buildBars();
  const raw = edition.periodes.flatMap(p => Object.values(p[selectedMetric]).filter(Number.isFinite));
  const max = Math.max(1,...raw);
  edition.periodes.forEach((period,i) => {
    const values = period[selectedMetric], bar = bars[i];
    // El nom accessible comença amb el text visible de la barra (nom i acumulat), WCAG 2.5.3.
    bar.button.setAttribute("aria-label",period.nom+". "+display(values.temporada)+" "+metric.unit+" de temporada. "+display(values.quinzena)+" "+metric.unit+" a la quinzena.");
    setCount(bar.value, values.temporada, metric.unit, animate);
    const t = values.temporada, q = values.quinzena;
    const hasT = Number.isFinite(t), hasQ = Number.isFinite(q);
    // Barra grisa: acumulat de temporada. Tram groc: la quinzena, al final de la barra grisa.
    // Sense acumulat, la quinzena es dibuixa des de l’origen.
    bar.target = {
      season: hasT ? t/max : 0,
      left: hasT ? Math.max(0,(hasQ ? t-q : t))/max : 0,
      fortnight: hasQ ? q/max : 0
    };
  });
  paintBars();
  el("chart-key").replaceChildren(node("span","Quinzena","key-period"),node("span","Temporada","key-season"));
  if(periodButtons.length) selectPeriod(selectedPeriod, !!animate);
}
function showPlot() {
  if (plotShown) return;
  plotShown = true;
  const plot = el("plot");
  plot.classList.add("plot-entering");
  // Força l’estat inicial abans de canviar la transformació perquè la transició s’executi.
  void plot.offsetWidth;
  paintBars();
  setTimeout(() => plot.classList.remove("plot-entering"), 70*bars.length + 1300);
}

/* ---------- Taula i activacions ---------- */
function detailTable() {
  const table=node("table"); table.append(node("caption","Activitat de La Molina per tall"));
  const head = node("thead"), rh=node("tr");
  for (const text of ["Indicador",...edition.periodes.map(p=>p.nom)]) {
    const th=node("th",text); th.scope="col"; rh.append(th);
  }
  head.append(rh); table.append(head);
  const body=node("tbody");
  const fields=[
    ["Visites de la quinzena",p=>display(p.visites.quinzena)],
    ["Visites de temporada",p=>display(p.visites.temporada)],
    ["Dies oberts a la quinzena",p=>display(p.obertura.quinzena)],
    ["Dies oberts de temporada",p=>display(p.obertura.temporada)],
    ["Km esquiables al tall",p=>Number.isFinite(p.kmAlTall)?display(p.kmAlTall)+" km":"Pendent"],
    ["Pistes obertes al tall",p=>display(p.pistesAlTall)]
  ];
  for(const [label,value] of fields){
    const row=node("tr"),title=node("th",label);title.scope="row";
    row.append(title,...edition.periodes.map(p=>node("td",value(p))));body.append(row);
  }
  table.append(body); el("facts").append(table);
  el("facts").append(node("p","L’acumulat inclou la quinzena. Els quilòmetres i les pistes indiquen l’oferta oberta el darrer dia de cada quinzena.","footnote"));
}
function activities() {
  const section=el("activitat");
  if (edition.activacions.length===0) {
    // Fitxa d’espera amb filet: etiqueta i edició a dalt, la nota de l’edició a baix.
    const block=node("div",undefined,"pending-block"), head=node("div",undefined,"pending-head");
    head.append(node("h3","Material pendent"));
    if (edition.etiqueta) head.append(node("span",edition.etiqueta,"pending-edition"));
    block.append(head,node("p",edition.notaActivacions));
    section.append(block); return;
  }
  for(const a of edition.activacions) {
    const article=node("article"); article.append(node("p",a.data),node("h3",a.titol),node("p",a.comentari));
    for(const photo of a.fotos || []){
      const img = document.createElement("img");img.src=photo.fitxer;img.alt=photo.descripcio;img.loading="lazy";article.append(img);
    }
    section.append(article);
  }
}
el("tipus").textContent=edition.model+" · "+edition.temporada;
el("edicio").textContent=edition.etiqueta+" / "+edition.model;
el("intro").textContent=edition.introduccio;
seasonKpis();metricButtons();renderChart(false);detailTable();activities();
// Dades al DOM: #dades ja es pot pintar (vegeu el script report-wait de l’index.html).
document.documentElement.classList.remove("report-wait");
// L’scrollspy de la navegació el gestiona motion-continental.js (LINE.motion.navSpy).
if (!plotShown) {
  const plotObserver = new IntersectionObserver(entries => {
    if(!entries.some(entry=>entry.isIntersecting)) return;
    plotObserver.disconnect(); showPlot();
  },{threshold:.25});
  plotObserver.observe(el("plot"));
}

// Fitxers de relleu locals. Es carreguen en un moment lliure després de la càrrega de la pàgina,
// o abans si la secció s’apropa: han d’estar llestos molt abans que comenci el vol d’entrada.
// API de pàgina: LINE.continental.terrain es resol amb LINE.terreny quan el relleu ja es pot dibuixar.
{
  const LINE = window.LINE = window.LINE || {};
  let resolveTerrain, started = false;
  const page = LINE.continental = LINE.continental || {};
  page.terrain = new Promise(resolve => { resolveTerrain = resolve; });
  const loadTerrainFile = path => new Promise((resolve,reject) => {
    const script=document.createElement("script");
    script.src=path; script.onload=resolve; script.onerror=reject;
    document.head.append(script);
  });
  const startTerrain = async () => {
    if (started) return;
    started = true;
    try {
      await loadTerrainFile("assets/relleu-dades.js"); await loadTerrainFile("terreny.js");
    } catch {
      el("terrain-readout").textContent="No s’ha pogut carregar el model local de terreny.";
      return;
    }
    if (LINE.terreny) LINE.terreny.ready.then(resolveTerrain);
  };
  const idle = () => (window.requestIdleCallback ? requestIdleCallback(startTerrain,{timeout:2000}) : setTimeout(startTerrain,300));
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, {once:true});
  if ("IntersectionObserver" in window) {
    const nearTerrain=new IntersectionObserver(entries=>{
      if(entries.some(e=>e.isIntersecting)){nearTerrain.disconnect();startTerrain();}
    },{rootMargin:"150% 0px"});
    nearTerrain.observe(el("territori"));
  } else startTerrain();
}
