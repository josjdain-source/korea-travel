// V22: Graph Query. The explainable vector space becomes queryable — relationships
// between any nodes, not just one-shot recommendations. Three honest query types
// over real creator-visit vectors. (Time-ordered "went next" + recency need
// timestamped traveler data = backend; here "also-visited" = co-visitation.)

let DATA = { creators: [], visits: [] };
let creatorById = {};
let creatorVecs = {}; // id -> action vector
let placeVisitors = {}; // place -> Set(creatorId)
let placeVecs = {}; // place -> action vector
let placeTexts = {}; // place -> [texts]
let TRIPS = { trips: [] }; // illustrative ordered trips (V24 demo)
let flow = {}; // from -> [{to, prob, n}]
let evo = {}; // identity -> [{to, prob, n}]  (V25 demo)
let state = { type: "closest" };

const QTYPES = [
  { key: "closest", label: "Closest creators to an identity" },
  { key: "also", label: "Visited X → also visited" },
  { key: "connect", label: "How do places connect? (why)" },
  { key: "flow", label: "Where next? (flow)" },
  { key: "evolve", label: "Who do you become? (evolution)" },
  { key: "compare", label: "Closer to A or B?" },
];

init();

async function init() {
  try {
    DATA = await (await fetch("data/visits.json")).json();
  } catch (e) {
    document.getElementById("q-result").innerHTML = `<p class="empty">Could not load data.</p>`;
    return;
  }
  creatorById = Object.fromEntries((DATA.creators || []).map((c) => [c.id, c]));
  for (const c of DATA.creators || []) {
    const vs = (DATA.visits || []).filter((v) => v.creatorId === c.id);
    creatorVecs[c.id] = actionVector(vs.map((v) => `${v.spot || ""} ${v.reason || ""}`));
  }
  for (const v of DATA.visits || []) {
    const k = v.place || v.city;
    (placeVisitors[k] = placeVisitors[k] || new Set()).add(v.creatorId);
    (placeTexts[k] = placeTexts[k] || []).push(`${v.spot || ""} ${v.reason || ""}`);
  }
  for (const [k, texts] of Object.entries(placeTexts)) placeVecs[k] = actionVector(texts);
  try { TRIPS = await (await fetch("data/trips_demo.json")).json(); } catch (e) { TRIPS = { trips: [] }; }
  flow = flowMatrix((TRIPS.trips || []).map((t) => t.seq));
  // V25: identity evolution = flowMatrix over (before → after) identity pairs.
  try {
    const ev = await (await fetch("data/identity_evolution_demo.json")).json();
    evo = flowMatrix((ev.transitions || []).map((t) => [t.before, t.after]));
  } catch (e) { evo = {}; }
  buildTypeChips();
  renderControl();
}

function buildTypeChips() {
  const el = document.getElementById("q-types");
  el.innerHTML = QTYPES.map((q, i) => `<button class="chip ${i === 0 ? "active" : ""}" data-type="${q.key}">${esc(q.label)}</button>`).join("");
  el.querySelectorAll(".chip").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.type = btn.dataset.type;
      el.querySelectorAll(".chip").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderControl();
    })
  );
}

function opts(list, vals) {
  return list.map((x, i) => `<option value="${esc(vals ? vals[i] : x)}">${esc(x)}</option>`).join("");
}

function renderControl() {
  const c = document.getElementById("q-control");
  const idNames = IDENTITIES.map((i) => i.name);
  const creators = DATA.creators || [];
  const places = Object.keys(placeVisitors).sort();

  if (state.type === "closest") {
    c.innerHTML = `<label>Identity <select id="q-id">${opts(idNames)}</select></label>`;
    document.getElementById("q-id").addEventListener("change", runClosest);
    runClosest();
  } else if (state.type === "also") {
    c.innerHTML = `<label>Place <select id="q-place">${opts(places)}</select></label>`;
    document.getElementById("q-place").addEventListener("change", runAlso);
    runAlso();
  } else if (state.type === "connect") {
    c.innerHTML = `<label>Place <select id="q-place">${opts(places)}</select></label>`;
    document.getElementById("q-place").addEventListener("change", runConnect);
    runConnect();
  } else if (state.type === "flow") {
    const froms = Object.keys(flow).sort();
    c.innerHTML = froms.length
      ? `<label>After visiting <select id="q-from">${opts(froms)}</select></label>`
      : `<p class="conf">No flow data.</p>`;
    if (froms.length) { document.getElementById("q-from").addEventListener("change", runFlow); runFlow(); }
  } else if (state.type === "evolve") {
    const froms = Object.keys(evo).sort();
    c.innerHTML = froms.length
      ? `<label>Starting as <select id="q-evo">${opts(froms)}</select></label>`
      : `<p class="conf">No evolution data.</p>`;
    if (froms.length) { document.getElementById("q-evo").addEventListener("change", runEvolve); runEvolve(); }
  } else {
    c.innerHTML = `
      <label>I'm a <select id="q-id">${opts(idNames)}</select></label>
      <label>A <select id="q-a">${opts(creators.map((x) => x.name), creators.map((x) => x.id))}</select></label>
      <label>B <select id="q-b">${opts(creators.map((x) => x.name), creators.map((x) => x.id))}</select></label>`;
    const b = document.getElementById("q-b");
    if (b.options[1]) b.selectedIndex = 1;
    ["q-id", "q-a", "q-b"].forEach((id) => document.getElementById(id).addEventListener("change", runCompare));
    runCompare();
  }
}

function runClosest() {
  const name = document.getElementById("q-id").value;
  const id = IDENTITIES.find((i) => i.name === name);
  const ranked = (DATA.creators || [])
    .map((c) => ({ c, sim: cosine(id.vec, creatorVecs[c.id]), shared: sharedDimensions(id.vec, creatorVecs[c.id]).map((d) => d.key) }))
    .filter((x) => x.sim > 0)
    .sort((a, b) => b.sim - a.sim);
  result(`Creators closest to <strong>${esc(name)}</strong>`,
    ranked.map((x) => `<div class="explain-row"><div class="explain-head"><span><strong>${esc(x.c.name)}</strong></span><span class="sim">${Math.round(x.sim * 100)}%</span></div><div class="explain-detail"><p class="conf">shared: ${x.shared.map(esc).join(", ") || "—"}</p></div></div>`).join(""));
}

function runAlso() {
  const place = document.getElementById("q-place").value;
  const visitors = placeVisitors[place] || new Set();
  const others = {};
  for (const v of DATA.visits || []) {
    if (!visitors.has(v.creatorId)) continue;
    const k = v.place || v.city;
    if (k === place) continue;
    (others[k] = others[k] || new Set()).add(v.creatorId);
  }
  const ranked = Object.entries(others).map(([k, s]) => ({ k, n: s.size })).sort((a, b) => b.n - a.n);
  result(`Creators who visited <strong>${esc(place)}</strong> also visited <span class="conf">(co-visitation, ${visitors.size} visitor${visitors.size === 1 ? "" : "s"})</span>`,
    ranked.length
      ? `<div class="titles">${ranked.map((x) => `<a class="tag" href="place.html?place=${encodeURIComponent(x.k)}&mode=place">${esc(x.k)} <em>${x.n}</em></a>`).join(" ")}</div>`
      : `<p class="conf">No co-visited places in the seed yet.</p>`);
}

// V23 (honest scaffold): undirected co-visitation EDGES with an explained "why".
// Direction & causality (A→B, why moved) need ordered trip data — that's V18.
function runConnect() {
  const place = document.getElementById("q-place").value;
  const visitorsP = placeVisitors[place] || new Set();
  const edges = [];
  for (const [other, visitorsQ] of Object.entries(placeVisitors)) {
    if (other === place) continue;
    const shared = [...visitorsP].filter((id) => visitorsQ.has(id)).length;
    if (!shared) continue;
    const why = sharedDimensions(placeVecs[place], placeVecs[other] || {}).map((d) => d.key);
    edges.push({ other, shared, why });
  }
  edges.sort((a, b) => b.shared - a.shared);
  result(`How <strong>${esc(place)}</strong> connects <span class="conf">(undirected co-visit edges — direction/causality needs trip-sequence data, V18)</span>`,
    edges.length
      ? edges.map((e) => `<div class="explain-row"><div class="explain-head"><span><a href="place.html?place=${encodeURIComponent(e.other)}&mode=place">${esc(place)} ↔ ${esc(e.other)}</a></span><span class="sim">${e.shared} shared</span></div><div class="explain-detail"><p class="conf">connected via: ${e.why.map(esc).join(", ") || "co-visitors only"}</p></div></div>`).join("")
      : `<p class="conf">No edges from this place in the seed yet.</p>`);
}

// V24 (illustrative) + Data Lineage: P(next | current) AND the exact source
// records each probability was computed from — so "why X?" is traceable to data,
// not just "cosine". (Over demo trips here; the lineage mechanism is real.)
function runFlow() {
  const from = document.getElementById("q-from").value;
  const nexts = flow[from] || [];
  const rows = nexts
    .map((x) => {
      const src = (TRIPS.trips || []).filter((t) => {
        for (let i = 0; i < t.seq.length - 1; i++) if (t.seq[i] === from && t.seq[i + 1] === x.to) return true;
        return false;
      });
      const lineage = src.map((t) => `<p class="conf">• ${esc(t.identity || "?")}: ${t.seq.map(esc).join(" → ")}</p>`).join("");
      return `<div class="explain-row"><div class="explain-head"><span><a href="place.html?place=${encodeURIComponent(x.to)}&mode=place">${esc(x.to)}</a></span><span class="sim">${Math.round(x.prob * 100)}% · n=${x.n} · lineage ▾</span></div><div class="explain-detail" hidden><p class="conf">Computed from ${src.length} record(s):</p>${lineage}</div></div>`;
    })
    .join("");
  result(`After <strong>${esc(from)}</strong>, this traveler flows to…`,
    `<p class="demo-banner">⚠ ILLUSTRATIVE — from invented demo trips (data/trips_demo.json). Real flow needs ordered trips at volume (backend). Each % below traces to its source records (data lineage) — that's how "why X?" gets a real answer.</p>${rows}`);
  document.querySelectorAll("#q-result .explain-head").forEach((btn) =>
    btn.addEventListener("click", (e) => { if (e.target.tagName !== "A") btn.nextElementSibling.hidden = !btn.nextElementSibling.hidden; })
  );
}

// V25 (illustrative): Identity(t) → Identity(t+1). What a traveler BECOMES.
function runEvolve() {
  const from = document.getElementById("q-evo").value;
  const nexts = evo[from] || [];
  result(`Starting as <strong>${esc(from)}</strong>, travelers grow into…`,
    `<p class="demo-banner">⚠ ILLUSTRATIVE — invented evolution pairs (data/identity_evolution_demo.json). Real identity evolution needs longitudinal records (identity_before → visit → identity_after, timestamped). We have none. Mechanism real; numbers invented.</p>
     ${nexts.map((x) => `<div class="explain-row"><div class="explain-head"><span>${esc(from)} → <strong>${esc(x.to)}</strong></span><span class="sim">${Math.round(x.prob * 100)}% · n=${x.n}</span></div></div>`).join("")}`);
}

function runCompare() {
  const id = IDENTITIES.find((i) => i.name === document.getElementById("q-id").value);
  const a = creatorById[document.getElementById("q-a").value];
  const b = creatorById[document.getElementById("q-b").value];
  const sa = cosine(id.vec, creatorVecs[a.id]);
  const sb = cosine(id.vec, creatorVecs[b.id]);
  const winner = sa === sb ? "It's a tie" : `You're closer to <strong>${esc(sa > sb ? a.name : b.name)}</strong>`;
  result(`As a ${esc(id.name)} — A vs B`,
    `<p style="font-size:1.1rem;">${winner}.</p>
     <div class="explain-row"><div class="explain-head"><span>${esc(a.name)}</span><span class="sim">${Math.round(sa * 100)}%</span></div><div class="explain-detail"><p class="conf">shared: ${sharedDimensions(id.vec, creatorVecs[a.id]).map((d) => esc(d.key)).join(", ") || "—"}</p></div></div>
     <div class="explain-row"><div class="explain-head"><span>${esc(b.name)}</span><span class="sim">${Math.round(sb * 100)}%</span></div><div class="explain-detail"><p class="conf">shared: ${sharedDimensions(id.vec, creatorVecs[b.id]).map((d) => esc(d.key)).join(", ") || "—"}</p></div></div>`);
}

function result(title, body) {
  document.getElementById("q-result").innerHTML = `<section class="place-sec"><h2>${title}</h2>${body}</section>`;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
