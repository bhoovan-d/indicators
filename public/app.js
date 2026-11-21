"use strict";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = { get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

// ---------- language: I18N (i18n.js) is keyed by the English text; numbers stay in Western digits ----------
let lang = store.get("lang", Object.keys(LANGS).find((l) => l !== "en" && navigator.language?.startsWith(l)) || "en");
if (!LANGS[lang]) lang = "en";
const t = (s, v = {}) => ((lang !== "en" && I18N[s]?.[Object.keys(LANGS).indexOf(lang) - 1]) || s).replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m);
const LOC = () => (lang === "en" ? "en-IN" : `${lang}-IN-u-nu-latn`);

let D;            // indicators.json
const st = { city: store.get("city", "Delhi"), sel: store.get("sel", "fuel.petrol.Delhi"), stock: null, range: 90, sort: { col: "v", dir: -1 }, flipped: false };

// ---------- series helpers ----------
const cache = new Map();
const pts = (k) => { if (!cache.has(k)) cache.set(k, Object.entries(D.series[k] || {})); return cache.get(k); };
const shift = (iso, days) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
function at(k, iso) { let v = null; for (const [d, x] of pts(k)) { if (d > iso) break; v = x; } return v; }
function stat(k) {
  const p = pts(k); if (!p.length) return null;
  const [date, v] = p[p.length - 1];
  const prev = p.length > 1 ? p[p.length - 2][1] : null, wk = at(k, shift(date, -7));
  return { date, v, dd: prev == null ? null : v - prev, dw: wk == null ? null : v - wk,
           pd: prev ? (v - prev) / prev * 100 : null, pw: wk ? (v - wk) / wk * 100 : null };
}
const realSince = (k) => (D.meta.real_since || {})[k];
const today = () => D.updated.slice(0, 10);

// ---------- formatting ----------
const fmt = (v, dp = 2) => v == null ? "—" : v.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const sgn = (v, dp = 2) => v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + fmt(Math.abs(v), dp);
const tone = (v, eps = 1e-9) => v == null || Math.abs(v) < eps ? "flat" : v > 0 ? "rise" : "fall";
const day = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString(LOC(), { day: "numeric", month: "short", timeZone: "UTC" });
const AQI = [[50, "Good", "#2f8f46", "#fff"], [100, "Satisfactory", "#8cbf3f", "#133b2f"], [200, "Moderate", "#f2d43a", "#133b2f"],
             [300, "Poor", "#ef8a2f", "#133b2f"], [400, "Very Poor", "#d93a2b", "#fff"], [1e9, "Severe", "#8a1f1a", "#fff"]];
const aqiCat = (v) => AQI.findIndex(([hi]) => v <= hi);
const aqiChip = (v) => { const [, n, bg, fg] = AQI[aqiCat(v)]; return `<span class="chip" style="background:${bg};color:${fg}">${t(n)}</span>`; };

// ---------- keys, names, units ----------
const kindOf = (k) => k.split(".").slice(0, -1).join(".");        // fuel.petrol.Delhi -> fuel.petrol
const cityOf = (k) => k.split(".").pop();
const groupOf = (k) => (k.startsWith("mandi") ? "thali" : k.split(".")[0]);
const CITYWISE = ["fuel.petrol", "fuel.diesel", "fuel.cng", "thali", "aqi"];
const isCityKey = (k) => CITYWISE.includes(kindOf(k)) && cityOf(k) !== "India";
const LABEL = { "fuel.petrol": "Petrol", "fuel.diesel": "Diesel", "fuel.cng": "CNG", "gold.24k": "Gold 24K", "gold.22k": "Gold 22K",
  "gold.silver": "Silver", thali: "Veg thali", aqi: "AQI", "mandi.onion": "Onion", "mandi.tomato": "Tomato", "mandi.potato": "Potato",
  "mandi.rice": "Rice", "mandi.wheat": "Wheat", "mandi.turdal": "Tur dal", "fuel.margin.petrol": "Petrol margin", "fuel.margin.diesel": "Diesel margin" };
const UNIT = { "fuel.petrol": "₹/L", "fuel.diesel": "₹/L", "fuel.cng": "₹/kg", "gold.24k": "₹/10 g", "gold.22k": "₹/10 g", "gold.silver": "₹/kg",
  thali: "₹/plate, 7-day avg", aqi: "index 0–500", "fuel.margin": "₹/L, Delhi, estimate" };
const unitOf = (k) => t(UNIT[k] || UNIT[kindOf(k)] || (k.startsWith("mandi") ? "₹/kg, mandi" : ""));
const dpOf = (k) => k.startsWith("gold") || k.startsWith("aqi") ? 0 : 2;
const nameOf = (k) => LABEL[k] ? t(LABEL[k]) : `${t(LABEL[kindOf(k)] || kindOf(k))} · ${t(cityOf(k) === "India" ? "all-India" : cityOf(k))}`;
const sourceOf = (k) => t(k.startsWith("fuel.margin") ? "Delhi pump price (PPAC) less fixed Delhi taxes and Brent × ₹/$ (Yahoo)" : k.startsWith("gold") ? "IBJA" : k.startsWith("aqi") ? "CPCB bulletin" : groupOf(k) === "thali" ? "Agmarknet via data.gov.in (wholesale)" :
  ["Delhi", "Mumbai", "Chennai", "Kolkata"].includes(cityOf(k)) && !k.includes("cng") ? "PPAC (IOC retail)" : "goodreturns.in");

// the metric switch shown in the workspace for each board (labels are translated when drawn)
const METRICS = {
  fuel: (c) => [["Petrol", `fuel.petrol.${c}`], ["Diesel", `fuel.diesel.${c}`], ["CNG", `fuel.cng.${c}`], ["Petrol margin", "fuel.margin.petrol"], ["Diesel margin", "fuel.margin.diesel"]],
  gold: () => [["24K", "gold.24k"], ["22K", "gold.22k"], ["Silver", "gold.silver"]],
  thali: (c) => [[t("Thali · {c}", { c: t(c) }), `thali.${c}`], [t("Thali · {c}", { c: t("India") }), "thali.India"], ["Onion", "mandi.onion.India"], ["Tomato", "mandi.tomato.India"],
                 ["Potato", "mandi.potato.India"], ["Rice", "mandi.rice.India"], ["Wheat", "mandi.wheat.India"], ["Tur dal", "mandi.turdal.India"]],
  aqi: (c) => [["AQI", `aqi.${c}`]],
};

function aqiExtremes() {
  const xs = D.meta.cities.map((c) => [c, stat(`aqi.${c}`)]).filter(([, s]) => s);
  const latest = xs.reduce((m, [, s]) => (s.date > m ? s.date : m), "");
  const rest = xs.filter(([c, s]) => s.date === latest && c !== st.city).sort((a, b) => b[1].v - a[1].v);
  return { worst: rest[0]?.[0], best: rest.at(-1)?.[0] };
}

function boards(c) {
  const ex = aqiExtremes();
  return [
    { id: "fuel", title: "Fuel", src: "₹/L · PPAC, goodreturns", rows: [
      { k: `fuel.petrol.${c}`, label: "Petrol" }, { k: `fuel.diesel.${c}`, label: "Diesel" }, { k: `fuel.cng.${c}`, label: "CNG", note: "₹/kg" },
      { k: "fuel.margin.petrol", label: "Petrol margin", note: "OMC ₹/L, Delhi est." }, { k: "fuel.margin.diesel", label: "Diesel margin", note: "OMC ₹/L, Delhi est." }] },
    { id: "gold", title: "Gold", src: "₹/10 g · IBJA, all India", rows: [
      { k: "gold.24k", label: "24K", pct: true }, { k: "gold.22k", label: "22K", pct: true }, { k: "gold.silver", label: "Silver", note: "₹/kg", pct: true }] },
    { id: "thali", title: "Thali", src: "₹/plate · 7-day avg · mandi", rows: [
      { k: `thali.${c}`, label: "Veg thali", note: c, pct: true }, { k: "thali.India", label: "India", note: "median mandis", pct: true },
      { k: "mandi.onion.India", label: "Onion", note: "₹/kg, all-India", pct: true }],
      empty: "Mandi prices haven't come in yet. They start with the next scrape once the data.gov.in API key is configured." },
    { id: "aqi", title: "AQI", src: "CPCB 4 PM bulletin", rows: [
      { k: `aqi.${c}`, label: c, me: true, aqi: true }, ex.worst && { k: `aqi.${ex.worst}`, label: ex.worst, note: "worst elsewhere", aqi: true },
      ex.best && { k: `aqi.${ex.best}`, label: ex.best, note: "cleanest elsewhere", aqi: true }].filter(Boolean) },
  ];
}

// ---------- alerts ----------
function alerts() {
  const out = [], fresh = (s) => s && s.date >= shift(today(), -2);
  const add = (sev, k, what, why, mag, num) => out.push({ sev, k, what, why, mag, num, board: groupOf(k), city: isCityKey(k) ? cityOf(k) : null });
  for (const c of D.meta.cities) {
    for (const f of ["petrol", "diesel", "cng"]) {
      const k = `fuel.${f}.${c}`, s = stat(k), n = t(LABEL["fuel." + f]).toLowerCase(), cc = t(c);
      if (fresh(s) && s.dd != null && Math.abs(s.dd) >= 0.1) add(2, k, t("{c} {f} revised", { c: cc, f: n }), t("{d} · now ₹{v}", { d: day(s.date), v: fmt(s.v) }), sgn(s.dd), s.dd);
      else if (fresh(s) && s.dw != null && Math.abs(s.dw) >= 1) add(1, k, t("{c} {f}, week", { c: cc, f: n }), t("now ₹{v}", { v: fmt(s.v) }), sgn(s.dw), s.dw);
    }
    const a = stat(`aqi.${c}`);
    if (fresh(a) && a.dd != null && aqiCat(a.v) > aqiCat(a.v - a.dd) && aqiCat(a.v) >= 3)
      add(3, `aqi.${c}`, t("{c} AQI crossed into {cat}", { c: t(c), cat: t(AQI[aqiCat(a.v)][1]) }), `${day(a.date)} · ${a.v}`, sgn(a.dd, 0), a.dd);
    else if (fresh(a) && a.dw != null && a.dw >= 50) add(2, `aqi.${c}`, t("{c} AQI up over the week", { c: t(c) }), `${t(AQI[aqiCat(a.v)][1])} · ${a.v}`, sgn(a.dw, 0), a.dw);
    const th = stat(`thali.${c}`);
    if (fresh(th) && th.pw != null && Math.abs(th.pw) >= 5) add(2, `thali.${c}`, t("{c} thali cost, week", { c: t(c) }), t("₹{v} a plate", { v: fmt(th.v) }), `${sgn(th.pw, 1)}%`, th.pw);
  }
  for (const k of ["fuel.margin.petrol", "fuel.margin.diesel"]) {  // ₹1/L of margin is roughly a 1.5–2% move in Brent
    const s = stat(k);
    if (fresh(s) && s.dw != null && Math.abs(s.dw) >= 1) add(2, k, t("{x} week move", { x: t(LABEL[k]) }), t("now ₹{v}", { v: fmt(s.v) }), sgn(s.dw), s.dw);
  }
  for (const k of ["gold.24k", "gold.silver"]) {
    const s = stat(k);
    if (!fresh(s)) continue;
    if (s.pd != null && Math.abs(s.pd) >= 1.5) add(3, k, t("{x} day move", { x: t(LABEL[k]) }), `${day(s.date)} · ₹${fmt(s.v, 0)}`, `${sgn(s.pd, 1)}%`, s.pd * 10);
    else if (s.pw != null && Math.abs(s.pw) >= 3) add(2, k, t("{x} week move", { x: t(LABEL[k]) }), `₹${fmt(s.v, 0)}`, `${sgn(s.pw, 1)}%`, s.pw * 10);
  }
  return out.sort((a, b) => b.sev - a.sev || Math.abs(b.num) - Math.abs(a.num));
}

// ---------- rail ----------
function renderBoards(al) {
  const active = groupOf(st.sel);
  $("#boards").innerHTML = boards(st.city).map((b) => {
    const hits = al.filter((a) => a.board === b.id && (!a.city || a.city === st.city));
    const any = b.rows.some((r) => pts(r.k).length);
    const cell = Math.max(3, ...b.rows.map((r) => { const s = stat(r.k); return s ? fmt(s.v, dpOf(r.k)).length : 1; }));
    const rows = !any ? `<div class="empty"><b>${t("Waiting for data")}</b>${esc(t(b.empty || "No data yet."))}</div>` : b.rows.map((r) => {
      const s = stat(r.k), dp = dpOf(r.k);
      if (!s) return `<button class="row" disabled><span class="k">${esc(t(r.label))}<small>${esc(t(r.note || ""))}</small></span><span class="v">—</span><span class="d flat">${t("no data")}</span></button>`;
      const dd = r.pct ? `${sgn(s.pd, 1)}%` : sgn(s.dd, dp), dw = r.pct ? `${sgn(s.pw, 1)}%` : sgn(s.dw, dp);
      const revised = !st.flipped && !r.k.includes("margin") && s.dd != null && Math.abs(s.dd) > 1e-9 && s.date >= shift(today(), -1);
      return `<button class="row${revised ? " revised" : ""}" data-k="${r.k}" aria-pressed="${r.k === st.sel}">
        <span class="k${r.me ? " city-me" : ""}">${esc(t(r.label))}${r.aqi ? aqiChip(s.v) : ""}<small>${esc(r.note ? t(r.note) : day(s.date))}</small></span>
        <span class="v"><i>${fmt(s.v, dp)}</i></span>
        <span class="d ${tone(s.dd)}">${dd}<small>${t("wk")} ${dw}</small></span></button>`;
    }).join("");
    const strip = hits.length ? `<p class="strip" title="${esc(hits.map((h) => h.what + " " + h.mag).join("\n"))}">${esc(hits[0].what)} · ${esc(hits[0].mag)}${hits.length > 1 ? ` · ${t("+{n} more", { n: hits.length - 1 })}` : ""}</p>`
                              : `<p class="strip calm">${esc(b.id === "gold" ? t("No alerts") : t("No alerts for {c}", { c: t(st.city) }))}</p>`;
    return `<article class="board${b.id === active ? " active" : ""}" style="--cell:${cell}" aria-labelledby="b-${b.id}"><header><h2 id="b-${b.id}">${t(b.title)}</h2><span>${esc(t(b.src))}</span></header>${strip}<div class="rows">${rows}</div></article>`;
  }).join("");
  $("#boards").removeAttribute("aria-busy");
  st.flipped = true;
}

// ---------- workspace ----------
function renderControls() {
  const opts = METRICS[groupOf(st.sel)](st.city);
  $("#metric").innerHTML = opts.length < 2 ? "" : opts.map(([l, k]) =>
    `<button data-k="${k}" aria-pressed="${k === st.sel}"${pts(k).length ? "" : ` disabled title="${t("No data yet")}"`}>${esc(t(l))}</button>`).join("");
  $("#city").value = st.city;
  const tks = Object.entries(D.meta.stocks || {}).filter(([, m]) => m.group === groupOf(st.sel));
  if (st.stock !== "" && !tks.some(([tk]) => tk === st.stock)) st.stock = tks[0]?.[0] ?? "";
  $("#stock").innerHTML = `<option value="">${t("No stock")}</option>` + tks.map(([tk, m]) => `<option value="${esc(tk)}"${tk === st.stock ? " selected" : ""}>${esc(m.name)}</option>`).join("");
}

const windowFrom = () => st.range ? shift(today(), -st.range) : "0";
function renderReadout() {
  const k = st.sel, s = stat(k), dp = dpOf(k), win = pts(k).filter(([d]) => d >= windowFrom()).map(([, v]) => v);
  if (!s) { $("#readout").innerHTML = `<h2>${esc(nameOf(k))}</h2><span class="hl">${t("No data yet")}</span>`; return; }
  const pct = groupOf(k) === "gold" || groupOf(k) === "thali";
  $("#readout").innerHTML = `<h2>${esc(nameOf(k))}</h2><span class="big">${fmt(s.v, dp)}</span>
    <span class="ch ${tone(s.dd)}">${pct ? sgn(s.pd, 1) + "%" : sgn(s.dd, dp)}<small>${t("day")}</small></span>
    <span class="ch ${tone(s.dw)}">${pct ? sgn(s.pw, 1) + "%" : sgn(s.dw, dp)}<small>${t("week")}</small></span>
    <span class="hl">${esc(t("{u} · {r} range {lo}–{hi} · as of {d}", { u: unitOf(k), r: st.range ? st.range + "D" : t("all"),
      lo: fmt(Math.min(...win), dp), hi: fmt(Math.max(...win), dp), d: day(s.date) }))}</span>`;
}

let chart, main = [], over;
function renderChart() {
  const k = st.sel, LC = window.LightweightCharts;
  if (!LC) { $("#plot").innerHTML = `<p class="empty"><b>${t("Chart library didn't load")}</b>${t("Check your connection and reload the page.")}</p>`; return; }
  if (!chart) {
    chart = LC.createChart($("#plot"), { autoSize: true, layout: { background: { color: "#fbfcfa" }, textColor: "#44564f", fontFamily: "Barlow, sans-serif" },
      grid: { vertLines: { color: "#e6ece8" }, horzLines: { color: "#e6ece8" } }, rightPriceScale: { visible: true, borderColor: "#cdd6d0" },
      leftPriceScale: { visible: true, borderColor: "#cdd6d0" }, timeScale: { borderColor: "#cdd6d0" }, crosshair: { mode: 0 },
      localization: { priceFormatter: (p) => p.toLocaleString("en-IN", { maximumFractionDigits: 2 }) } });
  }
  chart.applyOptions({ localization: { locale: LOC() } });
  main.forEach((s) => chart.removeSeries(s)); main = [];
  if (over) { chart.removeSeries(over); over = null; }
  const from = windowFrom();
  const data = pts(k).filter(([d]) => d >= from).map(([time, value]) => ({ time, value }));
  const rs = realSince(k), cut = rs ? data.findIndex((p) => p.time >= rs) : 0;
  const mk = (dash) => chart.addLineSeries({ color: "#133b2f", lineWidth: 2, lineStyle: dash ? 2 : 0, priceScaleId: "left",
    lineType: k.startsWith("fuel") && !k.includes("margin") ? 1 : 0, priceLineVisible: false, lastValueVisible: !dash });
  if (cut > 0) { const a = mk(true); a.setData(data.slice(0, cut + 1)); main.push(a); }
  if (cut < 0) { const a = mk(true); a.setData(data); main.push(a); }
  else { const b = mk(false); b.setData(cut > 0 ? data.slice(cut) : data); main.push(b); }
  const raw = k.startsWith("thali.") ? `thali_raw.${cityOf(k)}` : null;
  if (raw && pts(raw).length) {  // the noisy daily cost, faint, behind its 7-day average
    const r = chart.addLineSeries({ color: "#b8c6bf", lineWidth: 1, priceScaleId: "left", priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    r.setData(pts(raw).filter(([d]) => d >= from).map(([time, value]) => ({ time, value }))); main.unshift(r);
  }
  if (st.stock) {
    over = chart.addLineSeries({ color: "#88a096", lineWidth: 2, priceScaleId: "right", priceLineVisible: false });
    over.setData(pts("stock." + st.stock).filter(([d]) => d >= from).map(([time, value]) => ({ time, value })));
  }
  chart.timeScale().fitContent();
  const recon = cut !== 0 && data.length;
  $("#legend").innerHTML = `<span><i style="border-color:#133b2f"></i>${esc(t("{n} (left axis)", { n: nameOf(k) }))}</span>` +
    (recon ? `<span><i class="dash" style="border-color:#133b2f"></i>${esc(t("reconstructed before {d}", { d: rs ? day(rs) : t("daily tracking") }))}</span>` : "") +
    (raw ? `<span><i style="border-color:#b8c6bf"></i>${t("raw daily cost")}</span>` : "") +
    (st.stock ? `<span><i style="border-color:#88a096"></i>${esc(t("{s} close (right axis)", { s: st.stock }))}</span>` : "") +
    `<span>${esc(t("Source: {s}", { s: sourceOf(k) }))}</span>`;
}

const chev = (dir) => `<svg class="chev" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="${dir > 0 ? "M2 6.5 5 3.5l3 3" : "M2 3.5 5 6.5l3-3"}" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
function renderCompare() {
  const th = (col, label) => `<th${st.sort.col === col ? ` aria-sort="${st.sort.dir > 0 ? "ascending" : "descending"}"` : ""}><button data-sort="${col}">${label}${st.sort.col === col ? chev(st.sort.dir) : ""}</button></th>`;
  const kind = kindOf(st.sel), cityWise = CITYWISE.includes(kind);
  let rows, dp, label;
  if (cityWise) {
    rows = D.meta.cities.map((c) => ({ c: t(c), s: stat(`${kind}.${c}`), me: c === st.city, city: c, recon: (realSince(`${kind}.${c}`) || "") > shift(today(), -7) })).filter((r) => r.s);
    dp = dpOf(st.sel); label = t("{k}, all {n} cities", { k: t(LABEL[kind]), n: rows.length });
    $("#compare-hint").textContent = t("{u} · click a city to switch", { u: unitOf(st.sel) });
  } else {  // one national rate: compare the stocks it moves instead
    rows = Object.entries(D.meta.stocks || {}).filter(([, m]) => m.group === groupOf(st.sel))
      .map(([tk, m]) => ({ c: m.name, s: stat("stock." + tk), stock: tk })).filter((r) => r.s);
    dp = 2; label = t("Linked stocks");
    $("#compare-hint").textContent = t("NSE close · {x} is one national number · click a stock to compare it on the chart", { x: t(LABEL[kindOf(st.sel)] || LABEL[st.sel] || "this rate") });
  }
  const get = { c: (r) => r.c, v: (r) => r.s.v, dd: (r) => (cityWise ? r.s.dd : r.s.pd) ?? 0, dw: (r) => (cityWise ? r.s.dw : r.s.pw) ?? 0 }[st.sort.col];
  rows.sort((a, b) => (get(a) > get(b) ? 1 : get(a) < get(b) ? -1 : 0) * st.sort.dir);
  const vs = rows.map((r) => r.s.v), lo = Math.min(...vs) * 0.98, hi = Math.max(...vs);
  $("#compare-h").textContent = label;
  $("#rank").innerHTML = `<thead><tr><th><button disabled>#</button></th>${th("c", t(cityWise ? "City" : "Stock"))}${th("v", t("Today"))}${th("dd", t("Δ day"))}${th("dw", t("Δ week"))}<th><button disabled>${cityWise ? t("Range") : ""}</button></th></tr></thead><tbody>${
    rows.map((r, i) => `<tr ${r.city ? `data-city="${esc(r.city)}"` : `data-stock="${esc(r.stock)}"`} class="${r.me ? "me" : r.stock && r.stock === st.stock ? "on" : ""}">
      <td class="rk">${i + 1}</td><td>${esc(r.c)}${kind === "aqi" ? aqiChip(r.s.v) : ""}</td><td class="val">${fmt(r.s.v, dp)}</td>
      <td class="${tone(r.s.dd)}">${cityWise ? sgn(r.s.dd, dp) : sgn(r.s.pd, 1) + "%"}</td>
      <td class="${tone(r.s.dw)}"${r.recon ? ` title="${t("week change uses reconstructed history")}"` : ""}>${cityWise ? sgn(r.s.dw, dp) : sgn(r.s.pw, 1) + "%"}${r.recon ? "*" : ""}</td>
      <td class="barc">${cityWise ? `<span style="width:${hi === lo ? 100 : ((r.s.v - lo) / (hi - lo) * 100).toFixed(1)}%"></span>` : ""}</td></tr>`).join("")}</tbody>`;
}

function renderMovers(al) {
  $("#movers").innerHTML = al.length ? al.slice(0, 40).map((a) => `<li><button class="sev${a.sev}" data-mover="${a.k}">
      <span class="what">${esc(a.what)}</span><span class="why">${esc(a.why)}</span><span class="mag ${tone(a.num)}">${esc(a.mag)}</span></button></li>`).join("")
    : `<li class="empty"><b>${t("Quiet morning")}</b>${t("Nothing crossed an alert line today.")}</li>`;
}

function renderStatus() {
  const groups = {};
  for (const [name, v] of Object.entries(D.meta.status || {})) {
    const g = { fuel_ppac: "Fuel · PPAC metros", gold_ibja: "Gold · IBJA", aqi_cpcb: "AQI · CPCB bulletin", thali_mandi: "Thali · Agmarknet",
      stocks: "Stocks · Yahoo Finance", fuel_margin: "Fuel margin · Brent, ₹/$" }[name] || (/^(fuel|cng)_/.test(name) ? "Fuel · goodreturns (16 cities)" : name);
    (groups[t(g)] ||= []).push(v);
  }
  $("#status").innerHTML = Object.entries(groups).map(([g, vs]) => {
    const bad = vs.filter((v) => !v.ok).length;
    return `<li><span>${esc(g)}</span><span class="${bad ? "bad" : "ok"}">${bad ? t("{n} failing", { n: bad }) : t("OK")}</span></li>`;
  }).join("");
}

// ---------- cities view: every city against every city-level indicator ----------
const MATRIX = [
  { key: "fuel.petrol", label: "Petrol", unit: "₹/L" }, { key: "fuel.diesel", label: "Diesel", unit: "₹/L" },
  { key: "fuel.cng", label: "CNG", unit: "₹/kg" }, { key: "thali", label: "Thali", unit: "₹/plate, 7-day avg" },
  { key: "aqi", label: "AQI", unit: "0–500" },
];
// sequential (level): one railway-green hue, light -> dark. diverging (change): fall blue / neutral grey / rise red-brown.
const SEQ = [["#e0ebe5", "#133b2f"], ["#b2cdbf", "#133b2f"], ["#7fa694", "#133b2f"], ["#3b6b5a", "#fff"], ["#133b2f", "#fff"]];
const FALL = [["#dce8f4", "#133b2f"], ["#93b6db", "#133b2f"], ["#1e5fa0", "#fff"]];
const RISE = [["#f2dcd7", "#133b2f"], ["#d99a90", "#133b2f"], ["#a8321d", "#fff"]];
const MID = ["#eceeec", "#133b2f"];
const ord = (n) => lang !== "en" ? `#${n}` : n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
st.mmode = store.get("mmode", "level");
st.msort = { col: "score", dir: -1 };

function cityMatrix() {
  const rows = D.meta.cities.map((c) => ({ c, cells: {} }));
  for (const m of MATRIX) {
    const col = [];
    for (const r of rows) {
      const k = `${m.key}.${r.c}`, s = stat(k);
      if (!s) continue;
      const past = at(k, shift(s.date, -30));
      col.push(r.cells[m.key] = { k, v: s.v, ch: past ? (s.v - past) / past * 100 : null, dp: dpOf(k) });
    }
    // percentile among cities (0 = lowest, 1 = highest; ties share), and rank 1 = highest
    for (const f of ["v", "ch"]) {
      const xs = col.filter((x) => x[f] != null).map((x) => x[f]);
      for (const x of col) if (x[f] != null) {
        const below = xs.filter((y) => y < x[f]).length, same = xs.filter((y) => y === x[f]).length;
        x[f + "P"] = xs.length > 1 ? (below + (same - 1) / 2) / (xs.length - 1) : 0.5;
        x[f + "R"] = xs.filter((y) => y > x[f]).length + 1;
      }
    }
    col.maxCh = Math.max(...col.map((x) => Math.abs(x.ch ?? 0)), 1e-9);
    m.col = col;
  }
  // pressure score: the average percentile across a city's indicators (higher = costlier / dirtier, or rising faster)
  const f = st.mmode === "level" ? "vP" : "chP";
  for (const r of rows) {
    const ps = MATRIX.map((m) => r.cells[m.key]?.[f]).filter((p) => p != null);
    r.score = ps.length ? Math.round(ps.reduce((a, b) => a + b, 0) / ps.length * 100) : null;
  }
  const sc = rows.filter((r) => r.score != null).map((r) => r.score);
  rows.forEach((r) => { r.scoreR = sc.filter((s) => s > r.score).length + 1; });
  return rows;
}

function cellColor(m, x) {
  if (st.mmode === "level") return SEQ[Math.min(4, Math.floor(x.vP * 5))];
  if (x.ch == null || Math.abs(x.ch) < 1e-6) return MID;
  const s = x.ch / m.col.maxCh, i = Math.abs(s) < 0.15 ? -1 : Math.abs(s) < 0.45 ? 0 : Math.abs(s) < 0.75 ? 1 : 2;
  return i < 0 ? MID : (s > 0 ? RISE : FALL)[i];
}

function renderCities() {
  if (!D) return;
  const rows = cityMatrix(), level = st.mmode === "level";
  const get = st.msort.col === "c" ? (r) => t(r.c) : st.msort.col === "score" ? (r) => r.score ?? -1
    : (r) => r.cells[st.msort.col]?.[level ? "v" : "ch"] ?? -Infinity;
  rows.sort((a, b) => (get(a) > get(b) ? 1 : get(a) < get(b) ? -1 : 0) * st.msort.dir);
  const th = (col, label, unit) => `<th${st.msort.col === col ? ` aria-sort="${st.msort.dir > 0 ? "ascending" : "descending"}"` : ""}><button data-msort="${col}">${label}${st.msort.col === col ? chev(st.msort.dir) : ""}${unit ? `<small>${esc(unit)}</small>` : ""}</button></th>`;
  const scoreUnit = t(level ? "0–100, higher = costlier & dirtier" : "0–100, higher = rising faster");
  $("#matrix").innerHTML = `<thead><tr>${th("c", t("City"))}${MATRIX.map((m) => th(m.key, t(m.label), t(m.unit))).join("")}${th("score", t("Pressure"), scoreUnit)}</tr></thead><tbody>${
    rows.map((r) => { const cn = t(r.c); return `<tr class="${r.c === st.city ? "me" : ""}"><td class="cityname">${esc(cn)}</td>${MATRIX.map((m) => {
      const x = r.cells[m.key], ml = t(m.label);
      if (!x) return `<td class="na" title="${esc(t("{m} is not sold or tracked in {c}", { m: ml, c: cn }))}">—</td>`;
      const [bg, fg] = cellColor(m, x), n = m.col.length;
      const val = fmt(x.v, x.dp), chg = x.ch == null ? "—" : `${sgn(x.ch, 1)}%`;
      const label = t("{m} in {c}: {v} {u}, {r} highest of {n}; 30-day change {ch}", { m: ml, c: cn, v: val, u: t(m.unit), r: ord(x.vR), n, ch: chg });
      return `<td><button class="mcell" style="background:${bg};color:${fg}" data-cell="${x.k}" title="${esc(label)} · ${t("open on the desk")}" aria-label="${esc(label)}">
        <b>${level ? val : chg}</b><small>${level ? `${t("{r} of {n}", { r: ord(x.vR), n })} · ${chg}` : `${val} · ${t("{r} fastest", { r: ord(x.chR) })}`}</small></button></td>`;
    }).join("")}${r.score == null ? `<td class="na">—</td>` : `<td class="score"><button class="mcell" style="background:${SEQ[Math.min(4, Math.floor(r.score / 20))][0]};color:${SEQ[Math.min(4, Math.floor(r.score / 20))][1]}" data-mcity="${esc(r.c)}" title="${esc(t("Open {c} on the desk", { c: cn }))}" aria-label="${esc(t("{c} pressure score {s}, {r} of {n}", { c: cn, s: r.score, r: ord(r.scoreR), n: rows.length }))}">
      <b>${r.score}</b><small>${t("{r} of {n}", { r: ord(r.scoreR), n: rows.length })}</small></button></td>`}</tr>`; }).join("")}</tbody>`;

  const ramp = (cols) => cols.map(([bg]) => `<i style="background:${bg}"></i>`).join("");
  $("#ramp").innerHTML = level ? `<span>${t("lowest of 20")}</span>${ramp(SEQ)}<span>${t("highest")}</span>`
    : `<span>${t("falling")}</span>${ramp([...FALL].reverse())}${ramp([MID])}${ramp(RISE)}<span>${t("rising (vs 30 days ago)")}</span>`;

  const ranked = rows.filter((r) => r.score != null).sort((a, b) => b.score - a.score);
  const moves = MATRIX.flatMap((m) => m.col.filter((x) => x.ch != null).map((x) => ({ m, x, c: cityOf(x.k) })));
  const big = moves.sort((a, b) => Math.abs(b.x.ch) - Math.abs(a.x.ch))[0];
  const aqiTop = MATRIX.find((m) => m.key === "aqi").col.slice().sort((a, b) => b.v - a.v)[0];
  const b = (c) => `<b>${esc(t(c))}</b>`;
  $("#facts").innerHTML = level
    ? `<span>${t("Most pressured: {c} ({s})", { c: b(ranked[0].c), s: ranked[0].score })}</span><span>${t("Least: {c} ({s})", { c: b(ranked.at(-1).c), s: ranked.at(-1).score })}</span>` +
      (aqiTop ? `<span>${t("Worst air: {c} ({v})", { c: b(cityOf(aqiTop.k)), v: fmt(aqiTop.v, 0) })}</span>` : "")
    : `<span>${t("Heating fastest: {c}", { c: b(ranked[0].c) })}</span><span>${t("Cooling most: {c}", { c: b(ranked.at(-1).c) })}</span>` +
      (big ? `<span>${t("Biggest 30-day move: {x}", { x: `<b>${esc(t(big.c))} ${esc(t(big.m.label))} ${sgn(big.x.ch, 1)}%</b>` })}</span>` : "");
  $("#mnote").textContent = lang === "en" ? `Each indicator's colour ranks the 20 cities against each other. Pressure averages a city's ranks across the indicators it has. ` +
    `Click any cell to open it on the desk. Thali is wholesale mandi cost; non-metro fuel history before daily tracking is reconstructed.` : t("matrix.note");
  document.querySelectorAll("#mmode button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mmode === st.mmode));
}

// ---------- views: desk / cities (switching never scrolls, the back button works) ----------
function showView() {
  const v = location.hash === "#cities" ? "cities" : location.hash === "#desk" || location.hash === "" ? "desk" : null;
  if (!v) return;  // other anchors (e.g. #sources) keep the current view
  $(".desk").hidden = v !== "desk"; $("#cities").hidden = v !== "cities";
  document.querySelectorAll(".views a").forEach((a) => a.dataset.view === v ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  if (v === "cities") renderCities();
  scrollTo(0, 0);
}
addEventListener("hashchange", showView);

let AL = [];
function renderWork() { renderControls(); renderReadout(); renderChart(); renderCompare(); }
function render() { AL = alerts(); renderBoards(AL); renderMovers(AL); renderWork(); renderCities(); }

// ---------- actions: everything updates in place, nothing scrolls ----------
function select(k) {
  if (!pts(k).length || k === st.sel) return;
  if (groupOf(k) !== groupOf(st.sel)) st.stock = null;
  st.sel = k; store.set("sel", k);
  renderBoards(AL); renderWork();
}
function setCity(c) {
  if (!D.meta.cities.includes(c)) return;
  st.city = c; store.set("city", c);
  if (isCityKey(st.sel)) { st.sel = `${kindOf(st.sel)}.${c}`; store.set("sel", st.sel); }
  render();
}
document.addEventListener("click", (e) => {
  const tg = e.target;
  const cell = tg.closest("[data-cell]")?.dataset.cell;          // matrix cell -> that city + metric on the desk
  if (cell) {
    if (groupOf(cell) !== groupOf(st.sel)) st.stock = null;
    st.sel = cell; store.set("sel", cell); location.hash = "#desk"; return setCity(cityOf(cell));
  }
  const mc = tg.closest("[data-mcity]")?.dataset.mcity; if (mc) { location.hash = "#desk"; return setCity(mc); }
  const ms = tg.closest("[data-msort]")?.dataset.msort;
  if (ms) { st.msort = { col: ms, dir: st.msort.col === ms ? -st.msort.dir : ms === "c" ? 1 : -1 }; return renderCities(); }
  const mm = tg.closest("[data-mmode]")?.dataset.mmode; if (mm) { st.mmode = mm; store.set("mmode", mm); return renderCities(); }
  const k = tg.closest("[data-k]")?.dataset.k; if (k) return select(k);
  const m = tg.closest("[data-mover]")?.dataset.mover;
  if (m) {
    if (groupOf(m) !== groupOf(st.sel)) st.stock = null;
    if (isCityKey(m)) { st.sel = m; setCity(cityOf(m)); } else { st.sel = ""; select(m); }
    return;
  }
  const c = tg.closest("tr[data-city]")?.dataset.city; if (c) return setCity(c);
  const sk = tg.closest("tr[data-stock]")?.dataset.stock; if (sk) { st.stock = sk; renderControls(); renderChart(); renderCompare(); return; }
  const s = tg.closest("[data-sort]")?.dataset.sort;
  if (s) { st.sort = { col: s, dir: st.sort.col === s ? -st.sort.dir : s === "c" ? 1 : -1 }; return renderCompare(); }
  const r = tg.closest("[data-r]");
  if (r) { st.range = +r.dataset.r; document.querySelectorAll("#range button").forEach((b) => b.setAttribute("aria-pressed", b === r)); renderReadout(); renderChart(); }
});
$("#city").addEventListener("change", (e) => setCity(e.target.value));
$("#stock").addEventListener("change", (e) => { st.stock = e.target.value; renderChart(); renderCompare(); });

// thali.json is written by a PC in India (data.gov.in blocks GitHub's servers); it is optional and merged in
const getJSON = (u) => fetch(u, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
function renderStamp() {
  $("#stamp").textContent = D ? t("Data as of {d} IST", { d: new Date(D.updated).toLocaleString(LOC(),
    { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) })
    : t(D === null ? "Data unavailable" : "Loading…");
}

// ---------- language switch: static text carries data-i (key = its English text) or data-ia (aria-label key) ----------
function setLang(l) {
  lang = l; store.set("lang", l);
  document.documentElement.lang = l;
  document.title = t("India Pulse · daily street-level indicators");
  document.querySelectorAll("[data-i]").forEach((el) => { el.dataset.en ??= el.innerHTML; el.innerHTML = lang === "en" ? el.dataset.en : t(el.dataset.i || el.dataset.en); });
  document.querySelectorAll("[data-ia]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.ia)));
  renderStamp();
  if (!D) return;
  $("#city").innerHTML = D.meta.cities.map((c) => `<option value="${esc(c)}">${esc(t(c))}</option>`).join("");
  renderStatus(); render();
}
$("#lang").innerHTML = Object.entries(LANGS).map(([k, n]) => `<option value="${k}" lang="${k}"${k === lang ? " selected" : ""}>${n}</option>`).join("");
$("#lang").addEventListener("change", (e) => setLang(e.target.value));
setLang(lang);

Promise.all([getJSON("data/indicators.json"), getJSON("data/thali.json").catch(() => null)]).then(([d, th]) => {
  if (th) {
    Object.assign(d.series, th.series);
    Object.assign(d.meta.status, th.meta.status);
  }
  D = d;
  if (!D.meta.cities.includes(st.city)) st.city = "Delhi";
  if (!pts(st.sel).length) st.sel = `fuel.petrol.${st.city}`;
  setLang(lang); showView();
}).catch((err) => {
  D = null;
  $("#boards").innerHTML = `<div class="board empty"><b>${t("Couldn't load today's data")}</b>${esc(t("indicators.json failed to load ({e}). Reload the page; if it keeps failing, the morning scrape may not have run yet.", { e: err.message }))}</div>`;
  renderStamp();
});
