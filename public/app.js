"use strict";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = { get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

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
const day = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const AQI = [[50, "Good", "#2f8f46", "#fff"], [100, "Satisfactory", "#8cbf3f", "#14213d"], [200, "Moderate", "#f2d43a", "#14213d"],
             [300, "Poor", "#ef8a2f", "#14213d"], [400, "Very Poor", "#d93a2b", "#fff"], [1e9, "Severe", "#8a1f1a", "#fff"]];
const aqiCat = (v) => AQI.findIndex(([hi]) => v <= hi);
const aqiChip = (v) => { const [, n, bg, fg] = AQI[aqiCat(v)]; return `<span class="chip" style="background:${bg};color:${fg}">${n}</span>`; };

// ---------- keys, names, units ----------
const kindOf = (k) => k.split(".").slice(0, -1).join(".");        // fuel.petrol.Delhi -> fuel.petrol
const cityOf = (k) => k.split(".").pop();
const groupOf = (k) => (k.startsWith("mandi") ? "thali" : k.split(".")[0]);
const CITYWISE = ["fuel.petrol", "fuel.diesel", "fuel.cng", "thali", "aqi"];
const isCityKey = (k) => CITYWISE.includes(kindOf(k)) && cityOf(k) !== "India";
const LABEL = { "fuel.petrol": "Petrol", "fuel.diesel": "Diesel", "fuel.cng": "CNG", "gold.24k": "Gold 24K", "gold.22k": "Gold 22K",
  "gold.silver": "Silver", thali: "Veg thali", aqi: "AQI", "mandi.onion": "Onion", "mandi.tomato": "Tomato", "mandi.potato": "Potato",
  "mandi.rice": "Rice", "mandi.wheat": "Wheat", "mandi.turdal": "Tur dal" };
const UNIT = { "fuel.petrol": "₹/L", "fuel.diesel": "₹/L", "fuel.cng": "₹/kg", "gold.24k": "₹/10 g", "gold.22k": "₹/10 g", "gold.silver": "₹/kg",
  thali: "₹/plate, 7-day avg", aqi: "index 0–500" };
const unitOf = (k) => UNIT[k] || UNIT[kindOf(k)] || (k.startsWith("mandi") ? "₹/kg, mandi" : "");
const dpOf = (k) => k.startsWith("gold") || k.startsWith("aqi") ? 0 : 2;
const nameOf = (k) => k.startsWith("gold") ? LABEL[k] : `${LABEL[kindOf(k)] || kindOf(k)} · ${cityOf(k) === "India" ? "all-India" : cityOf(k)}`;
const sourceOf = (k) => k.startsWith("gold") ? "IBJA" : k.startsWith("aqi") ? "CPCB bulletin" : groupOf(k) === "thali" ? "Agmarknet via data.gov.in (wholesale)" :
  ["Delhi", "Mumbai", "Chennai", "Kolkata"].includes(cityOf(k)) && !k.includes("cng") ? "PPAC (IOC retail)" : "goodreturns.in";

// the metric switch shown in the workspace for each board
const METRICS = {
  fuel: (c) => [["Petrol", `fuel.petrol.${c}`], ["Diesel", `fuel.diesel.${c}`], ["CNG", `fuel.cng.${c}`]],
  gold: () => [["24K", "gold.24k"], ["22K", "gold.22k"], ["Silver", "gold.silver"]],
  thali: (c) => [[`Thali · ${c}`, `thali.${c}`], ["Thali · India", "thali.India"], ["Onion", "mandi.onion.India"], ["Tomato", "mandi.tomato.India"],
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
      { k: `fuel.petrol.${c}`, label: "Petrol" }, { k: `fuel.diesel.${c}`, label: "Diesel" }, { k: `fuel.cng.${c}`, label: "CNG", note: "₹/kg" }] },
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
  const add = (sev, k, what, why, mag, num) => out.push({ sev, k, what, why, mag, num, board: groupOf(k), city: cityOf(k) });
  for (const c of D.meta.cities) {
    for (const f of ["petrol", "diesel", "cng"]) {
      const k = `fuel.${f}.${c}`, s = stat(k), n = LABEL["fuel." + f].toLowerCase();
      if (fresh(s) && s.dd != null && Math.abs(s.dd) >= 0.1) add(2, k, `${c} ${n} revised`, `${day(s.date)} · now ₹${fmt(s.v)}`, sgn(s.dd), s.dd);
      else if (fresh(s) && s.dw != null && Math.abs(s.dw) >= 1) add(1, k, `${c} ${n}, week`, `now ₹${fmt(s.v)}`, sgn(s.dw), s.dw);
    }
    const a = stat(`aqi.${c}`);
    if (fresh(a) && a.dd != null && aqiCat(a.v) > aqiCat(a.v - a.dd) && aqiCat(a.v) >= 3)
      add(3, `aqi.${c}`, `${c} AQI crossed into ${AQI[aqiCat(a.v)][1]}`, `${day(a.date)} · ${a.v}`, sgn(a.dd, 0), a.dd);
    else if (fresh(a) && a.dw != null && a.dw >= 50) add(2, `aqi.${c}`, `${c} AQI up over the week`, `${AQI[aqiCat(a.v)][1]} · ${a.v}`, sgn(a.dw, 0), a.dw);
    const t = stat(`thali.${c}`);
    if (fresh(t) && t.pw != null && Math.abs(t.pw) >= 5) add(2, `thali.${c}`, `${c} thali cost, week`, `₹${fmt(t.v)} a plate`, `${sgn(t.pw, 1)}%`, t.pw);
  }
  for (const k of ["gold.24k", "gold.silver"]) {
    const s = stat(k);
    if (!fresh(s)) continue;
    if (s.pd != null && Math.abs(s.pd) >= 1.5) add(3, k, `${LABEL[k]} day move`, `${day(s.date)} · ₹${fmt(s.v, 0)}`, `${sgn(s.pd, 1)}%`, s.pd * 10);
    else if (s.pw != null && Math.abs(s.pw) >= 3) add(2, k, `${LABEL[k]} week move`, `₹${fmt(s.v, 0)}`, `${sgn(s.pw, 1)}%`, s.pw * 10);
  }
  return out.sort((a, b) => b.sev - a.sev || Math.abs(b.num) - Math.abs(a.num));
}

// ---------- rail ----------
function renderBoards(al) {
  const active = groupOf(st.sel);
  $("#boards").innerHTML = boards(st.city).map((b) => {
    const hits = al.filter((a) => a.board === b.id && (b.id === "gold" || a.city === st.city));
    const any = b.rows.some((r) => pts(r.k).length);
    const cell = Math.max(3, ...b.rows.map((r) => { const s = stat(r.k); return s ? fmt(s.v, dpOf(r.k)).length : 1; }));
    const rows = !any ? `<div class="empty"><b>Waiting for data</b>${esc(b.empty || "No data yet.")}</div>` : b.rows.map((r) => {
      const s = stat(r.k), dp = dpOf(r.k);
      if (!s) return `<button class="row" disabled><span class="k">${esc(r.label)}<small>${esc(r.note || "")}</small></span><span class="v">—</span><span class="d flat">no data</span></button>`;
      const dd = r.pct ? `${sgn(s.pd, 1)}%` : sgn(s.dd, dp), dw = r.pct ? `${sgn(s.pw, 1)}%` : sgn(s.dw, dp);
      const revised = !st.flipped && s.dd != null && Math.abs(s.dd) > 1e-9 && s.date >= shift(today(), -1);
      return `<button class="row${revised ? " revised" : ""}" data-k="${r.k}" aria-pressed="${r.k === st.sel}">
        <span class="k${r.me ? " city-me" : ""}">${esc(r.label)}${r.aqi ? aqiChip(s.v) : ""}<small>${esc(r.note || day(s.date))}</small></span>
        <span class="v"><i>${fmt(s.v, dp)}</i></span>
        <span class="d ${tone(s.dd)}">${dd}<small>wk ${dw}</small></span></button>`;
    }).join("");
    const strip = hits.length ? `<p class="strip" title="${esc(hits.map((h) => h.what + " " + h.mag).join("\n"))}">${esc(hits[0].what)} · ${esc(hits[0].mag)}${hits.length > 1 ? ` · +${hits.length - 1} more` : ""}</p>`
                              : `<p class="strip calm">No alerts${b.id === "gold" ? "" : " for " + esc(st.city)}</p>`;
    return `<article class="board${b.id === active ? " active" : ""}" style="--cell:${cell}" aria-labelledby="b-${b.id}"><header><h2 id="b-${b.id}">${b.title}</h2><span>${esc(b.src)}</span></header>${strip}<div class="rows">${rows}</div></article>`;
  }).join("");
  $("#boards").removeAttribute("aria-busy");
  st.flipped = true;
}

// ---------- workspace ----------
function renderControls() {
  const opts = METRICS[groupOf(st.sel)](st.city);
  $("#metric").innerHTML = opts.length < 2 ? "" : opts.map(([l, k]) =>
    `<button data-k="${k}" aria-pressed="${k === st.sel}"${pts(k).length ? "" : " disabled title=\"No data yet\""}>${esc(l)}</button>`).join("");
  $("#city").value = st.city;
  const tks = Object.entries(D.meta.stocks || {}).filter(([, m]) => m.group === groupOf(st.sel));
  if (st.stock !== "" && !tks.some(([t]) => t === st.stock)) st.stock = tks[0]?.[0] ?? "";
  $("#stock").innerHTML = `<option value="">None</option>` + tks.map(([t, m]) => `<option value="${esc(t)}"${t === st.stock ? " selected" : ""}>${esc(m.name)}</option>`).join("");
}

const windowFrom = () => st.range ? shift(today(), -st.range) : "0";
function renderReadout() {
  const k = st.sel, s = stat(k), dp = dpOf(k), win = pts(k).filter(([d]) => d >= windowFrom()).map(([, v]) => v);
  if (!s) { $("#readout").innerHTML = `<h2>${esc(nameOf(k))}</h2><span class="hl">No data yet</span>`; return; }
  const pct = groupOf(k) === "gold" || groupOf(k) === "thali";
  $("#readout").innerHTML = `<h2>${esc(nameOf(k))}</h2><span class="big">${fmt(s.v, dp)}</span>
    <span class="ch ${tone(s.dd)}">${pct ? sgn(s.pd, 1) + "%" : sgn(s.dd, dp)}<small>day</small></span>
    <span class="ch ${tone(s.dw)}">${pct ? sgn(s.pw, 1) + "%" : sgn(s.dw, dp)}<small>week</small></span>
    <span class="hl">${esc(unitOf(k))} · ${st.range ? st.range + "D" : "all"} range ${fmt(Math.min(...win), dp)}–${fmt(Math.max(...win), dp)} · as of ${day(s.date)}</span>`;
}

let chart, main = [], over;
function renderChart() {
  const k = st.sel, LC = window.LightweightCharts;
  if (!LC) { $("#plot").innerHTML = `<p class="empty"><b>Chart library didn't load</b>Check your connection and reload the page.</p>`; return; }
  if (!chart) {
    chart = LC.createChart($("#plot"), { autoSize: true, layout: { background: { color: "#fbfcfd" }, textColor: "#4a5470", fontFamily: "Barlow, sans-serif" },
      grid: { vertLines: { color: "#e8ebf0" }, horzLines: { color: "#e8ebf0" } }, rightPriceScale: { visible: true, borderColor: "#cfd5de" },
      leftPriceScale: { visible: true, borderColor: "#cfd5de" }, timeScale: { borderColor: "#cfd5de" }, crosshair: { mode: 0 },
      localization: { priceFormatter: (p) => p.toLocaleString("en-IN", { maximumFractionDigits: 2 }) } });
  }
  main.forEach((s) => chart.removeSeries(s)); main = [];
  if (over) { chart.removeSeries(over); over = null; }
  const from = windowFrom();
  const data = pts(k).filter(([d]) => d >= from).map(([time, value]) => ({ time, value }));
  const rs = realSince(k), cut = rs ? data.findIndex((p) => p.time >= rs) : 0;
  const mk = (dash) => chart.addLineSeries({ color: "#14213d", lineWidth: 2, lineStyle: dash ? 2 : 0, priceScaleId: "left",
    lineType: k.startsWith("fuel") ? 1 : 0, priceLineVisible: false, lastValueVisible: !dash });
  if (cut > 0) { const a = mk(true); a.setData(data.slice(0, cut + 1)); main.push(a); }
  if (cut < 0) { const a = mk(true); a.setData(data); main.push(a); }
  else { const b = mk(false); b.setData(cut > 0 ? data.slice(cut) : data); main.push(b); }
  const raw = k.startsWith("thali.") ? `thali_raw.${cityOf(k)}` : null;
  if (raw && pts(raw).length) {  // the noisy daily cost, faint, behind its 7-day average
    const r = chart.addLineSeries({ color: "#b9c1cf", lineWidth: 1, priceScaleId: "left", priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    r.setData(pts(raw).filter(([d]) => d >= from).map(([time, value]) => ({ time, value }))); main.unshift(r);
  }
  if (st.stock) {
    over = chart.addLineSeries({ color: "#8c98ad", lineWidth: 2, priceScaleId: "right", priceLineVisible: false });
    over.setData(pts("stock." + st.stock).filter(([d]) => d >= from).map(([time, value]) => ({ time, value })));
  }
  chart.timeScale().fitContent();
  const recon = cut !== 0 && data.length;
  $("#legend").innerHTML = `<span><i style="border-color:#14213d"></i>${esc(nameOf(k))} (left axis)</span>` +
    (recon ? `<span><i class="dash" style="border-color:#14213d"></i>reconstructed before ${rs ? day(rs) : "daily tracking"}</span>` : "") +
    (raw ? `<span><i style="border-color:#b9c1cf"></i>raw daily cost</span>` : "") +
    (st.stock ? `<span><i style="border-color:#8c98ad"></i>${esc(st.stock)} close (right axis)</span>` : "") +
    `<span>Source: ${esc(sourceOf(k))}</span>`;
}

const chev = (dir) => `<svg class="chev" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="${dir > 0 ? "M2 6.5 5 3.5l3 3" : "M2 3.5 5 6.5l3-3"}" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
function renderCompare() {
  const th = (col, label) => `<th${st.sort.col === col ? ` aria-sort="${st.sort.dir > 0 ? "ascending" : "descending"}"` : ""}><button data-sort="${col}">${label}${st.sort.col === col ? chev(st.sort.dir) : ""}</button></th>`;
  const kind = kindOf(st.sel), cityWise = CITYWISE.includes(kind);
  let rows, dp, label;
  if (cityWise) {
    rows = D.meta.cities.map((c) => ({ c, s: stat(`${kind}.${c}`), me: c === st.city, city: c, recon: (realSince(`${kind}.${c}`) || "") > shift(today(), -7) })).filter((r) => r.s);
    dp = dpOf(st.sel); label = `${LABEL[kind]}, all ${rows.length} cities`;
    $("#compare-hint").textContent = `${unitOf(st.sel)} · click a city to switch`;
  } else {  // one national rate: compare the stocks it moves instead
    rows = Object.entries(D.meta.stocks || {}).filter(([, m]) => m.group === groupOf(st.sel))
      .map(([t, m]) => ({ c: m.name, s: stat("stock." + t), stock: t })).filter((r) => r.s);
    dp = 2; label = "Linked stocks";
    $("#compare-hint").textContent = `NSE close · ${LABEL[kindOf(st.sel)] || LABEL[st.sel] || "this rate"} is one national number · click to overlay`;
  }
  const get = { c: (r) => r.c, v: (r) => r.s.v, dd: (r) => (cityWise ? r.s.dd : r.s.pd) ?? 0, dw: (r) => (cityWise ? r.s.dw : r.s.pw) ?? 0 }[st.sort.col];
  rows.sort((a, b) => (get(a) > get(b) ? 1 : get(a) < get(b) ? -1 : 0) * st.sort.dir);
  const vs = rows.map((r) => r.s.v), lo = Math.min(...vs) * 0.98, hi = Math.max(...vs);
  $("#compare-h").textContent = label;
  $("#rank").innerHTML = `<thead><tr><th><button disabled>#</button></th>${th("c", cityWise ? "City" : "Stock")}${th("v", "Today")}${th("dd", "Δ day")}${th("dw", "Δ week")}<th><button disabled>${cityWise ? "Range" : ""}</button></th></tr></thead><tbody>${
    rows.map((r, i) => `<tr ${r.city ? `data-city="${esc(r.city)}"` : `data-stock="${esc(r.stock)}"`} class="${r.me ? "me" : r.stock && r.stock === st.stock ? "on" : ""}">
      <td class="rk">${i + 1}</td><td>${esc(r.c)}${kind === "aqi" ? aqiChip(r.s.v) : ""}</td><td class="val">${fmt(r.s.v, dp)}</td>
      <td class="${tone(r.s.dd)}">${cityWise ? sgn(r.s.dd, dp) : sgn(r.s.pd, 1) + "%"}</td>
      <td class="${tone(r.s.dw)}"${r.recon ? ' title="week change uses reconstructed history"' : ""}>${cityWise ? sgn(r.s.dw, dp) : sgn(r.s.pw, 1) + "%"}${r.recon ? "*" : ""}</td>
      <td class="barc">${cityWise ? `<span style="width:${hi === lo ? 100 : ((r.s.v - lo) / (hi - lo) * 100).toFixed(1)}%"></span>` : ""}</td></tr>`).join("")}</tbody>`;
}

function renderMovers(al) {
  $("#movers").innerHTML = al.length ? al.slice(0, 40).map((a) => `<li><button class="sev${a.sev}" data-mover="${a.k}">
      <span class="what">${esc(a.what)}</span><span class="why">${esc(a.why)}</span><span class="mag ${tone(a.num)}">${esc(a.mag)}</span></button></li>`).join("")
    : `<li class="empty"><b>Quiet morning</b>Nothing crossed an alert line today.</li>`;
}

function renderStatus() {
  const groups = {};
  for (const [name, v] of Object.entries(D.meta.status || {})) {
    const g = { fuel_ppac: "Fuel · PPAC metros", gold_ibja: "Gold · IBJA", aqi_cpcb: "AQI · CPCB bulletin", thali_mandi: "Thali · Agmarknet",
      stocks: "Stocks · Yahoo Finance" }[name] || (/^(fuel|cng)_/.test(name) ? "Fuel · goodreturns (16 cities)" : name);
    (groups[g] ||= []).push(v);
  }
  $("#status").innerHTML = Object.entries(groups).map(([g, vs]) => {
    const bad = vs.filter((v) => !v.ok).length;
    return `<li><span>${esc(g)}</span><span class="${bad ? "bad" : "ok"}">${bad ? `${bad} failing` : "OK"}</span></li>`;
  }).join("");
}

let AL = [];
function renderWork() { renderControls(); renderReadout(); renderChart(); renderCompare(); }
function render() { AL = alerts(); renderBoards(AL); renderMovers(AL); renderWork(); }

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
  const t = e.target;
  const k = t.closest("[data-k]")?.dataset.k; if (k) return select(k);
  const m = t.closest("[data-mover]")?.dataset.mover;
  if (m) {
    if (groupOf(m) !== groupOf(st.sel)) st.stock = null;
    if (isCityKey(m)) { st.sel = m; setCity(cityOf(m)); } else { st.sel = ""; select(m); }
    return;
  }
  const c = t.closest("tr[data-city]")?.dataset.city; if (c) return setCity(c);
  const sk = t.closest("tr[data-stock]")?.dataset.stock; if (sk) { st.stock = sk; renderControls(); renderChart(); renderCompare(); return; }
  const s = t.closest("[data-sort]")?.dataset.sort;
  if (s) { st.sort = { col: s, dir: st.sort.col === s ? -st.sort.dir : s === "c" ? 1 : -1 }; return renderCompare(); }
  const r = t.closest("[data-r]");
  if (r) { st.range = +r.dataset.r; document.querySelectorAll("#range button").forEach((b) => b.setAttribute("aria-pressed", b === r)); renderReadout(); renderChart(); }
});
$("#city").addEventListener("change", (e) => setCity(e.target.value));
$("#stock").addEventListener("change", (e) => { st.stock = e.target.value; renderChart(); renderCompare(); });

fetch("data/indicators.json", { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((d) => {
  D = d;
  if (!D.meta.cities.includes(st.city)) st.city = "Delhi";
  if (!pts(st.sel).length) st.sel = `fuel.petrol.${st.city}`;
  $("#city").innerHTML = D.meta.cities.map((c) => `<option>${esc(c)}</option>`).join("");
  const u = new Date(D.updated);
  $("#stamp").textContent = `Data as of ${u.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} IST`;
  renderStatus(); render();
}).catch((err) => {
  $("#boards").innerHTML = `<div class="board empty"><b>Couldn't load today's data</b>indicators.json failed to load (${esc(err.message)}). Reload the page; if it keeps failing, the morning scrape may not have run yet.</div>`;
  $("#stamp").textContent = "Data unavailable";
});
