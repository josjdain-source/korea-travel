// Place detail page: who went, the videos they made, why (DNA), what they did
// (actions), similar places, how to follow. All real data from data/visits.json.
// Theme/action vocab + scoring come from engine.js (loaded before this file).

let DATA = { creators: [], visits: [] };
let creatorById = {};
let TRENDS = {};

init();

async function init() {
  const params = new URLSearchParams(location.search);
  const placeKey = params.get("place");
  const mode = params.get("mode") === "city" ? "city" : "place";
  try {
    DATA = await (await fetch("data/visits.json")).json();
  } catch (e) {
    return fail("Could not load data.");
  }
  try {
    const td = await (await fetch("data/trends.json")).json();
    TRENDS = td.places || {};
  } catch (_) { /* trends optional */ }
  creatorById = Object.fromEntries((DATA.creators || []).map((c) => [c.id, c]));

  const keyOf = (v) => (mode === "city" ? v.city : v.place || v.city);
  const visits = (DATA.visits || []).filter((v) => keyOf(v) === placeKey);
  if (!visits.length) return fail("Place not found.");

  // V18 spine: a visit event. Ordered visit events per device = the real seed of
  // the trip sequences that Flow (V24) / Transition (V23) need.
  if (typeof RR_MEM !== "undefined") {
    const t = RR_MEM.traveler();
    RR_MEM.logEvent("visit", { place: placeKey, identity_after: t ? t.identity : null });
  }
  render(placeKey, visits, mode);
}

function render(placeKey, visits, mode) {
  const first = visits[0];
  const creatorIds = [...new Set(visits.map((v) => v.creatorId))];
  const totalViews = visits.reduce((a, v) => a + (Number(v.views) || 0), 0);

  // Global-interest star (creator reach vs the busiest place) — labelled honestly.
  const allPlaces = groupAll(mode);
  const maxCreators = Math.max(...allPlaces.map((p) => p.creatorIds.length));
  const stars = "★".repeat(Math.max(1, Math.round((creatorIds.length / maxCreators) * 5))).padEnd(5, "☆");

  const creatorTags = creatorIds
    .map((id) => creatorById[id])
    .filter(Boolean)
    .map((c) => `<a class="creator-card" href="${c.url}" target="_blank" rel="noopener"><strong>${esc(c.name)}</strong><span>${esc(c.country || "")} · ${fmtSubs(c.subscribers)}</span></a>`)
    .join("");

  const videos = visits
    .filter((v) => v.videoUrl)
    .map((v) => {
      const c = creatorById[v.creatorId];
      return `<div class="video-item">
        <a class="video-row" href="${v.videoUrl}" target="_blank" rel="noopener">▶ <span class="vtitle">${esc(v.spot || "video")}</span><span class="vmeta">${c ? esc(c.name) : ""} · ${fmtViews(v.views)} views</span></a>
        ${sceneStripHtml(v)}
      </div>`;
    })
    .join("");

  // V4: actions creators did here, with the real count of creators per action.
  const actionCounts = {};
  for (const v of visits) {
    for (const act of actionsOf(`${v.spot || ""} ${v.reason || ""}`)) {
      (actionCounts[act] = actionCounts[act] || new Set()).add(v.creatorId);
    }
  }
  const actionsHtml = Object.entries(actionCounts)
    .map(([act, set]) => ({ act, n: set.size }))
    .sort((a, b) => b.n - a.n)
    .map((x) => `<a class="tag" href="ranking.html?action=${encodeURIComponent(x.act)}">${esc(x.act)} <em>${x.n} creator${x.n === 1 ? "" : "s"}</em></a>`)
    .join(" ");

  const dna = dnaPercent(profileOf(visits));
  const dnaBars = dna
    .map((d) => `<div class="dna-row"><span class="dna-label">${esc(d.theme)}</span><span class="dna-bar"><span style="width:${d.pct}%"></span></span><span class="dna-pct">${d.pct}%</span></div>`)
    .join("");

  const sims = similarPlaces(placeKey, visits, allPlaces);
  const simHtml = sims.length
    ? sims.map((s) => `<a class="tag" href="place.html?place=${encodeURIComponent(s.label)}&mode=${mode}">${esc(s.label)} <em>${Math.round(s.sim * 100)}% match</em></a>`).join(" ")
    : `<span class="conf">Not enough overlapping data yet to suggest a match.</span>`;

  const td = TRENDS[placeKey] || TRENDS[first.city] || null;
  const trendHtml = td && td.trend === "rising"
    ? `<span class="trend-badge trend-rising">🔥 Rising ${td.delta > 0 ? "+" + td.delta : td.delta}% on Google Trends</span>`
    : td && td.trend === "up"
    ? `<span class="trend-badge trend-up">↑ Trending on Google Trends</span>`
    : "";

  document.getElementById("place-body").innerHTML = `
    <header class="place-head">
      <h1>${esc(placeKey)} ${trendHtml}</h1>
      <p class="place-sub">${esc(first.city)} · ${esc(first.region || "")}</p>
      <p class="place-metric"><span class="stars">${stars}</span> Global interest — ${creatorIds.length} foreign creator${creatorIds.length === 1 ? "" : "s"} · ${fmtViews(totalViews)} combined views</p>
    </header>

    <section class="place-sec">
      <h2>Creators who went</h2>
      <div class="creator-grid">${creatorTags}</div>
    </section>

    ${videos ? `<section class="place-sec"><h2>🎥 What they filmed here</h2><div class="video-list">${videos}</div></section>` : ""}

    <section class="place-sec">
      <h2>What creators do here <span class="conf">— inferred from each creator's video (first pass)</span></h2>
      <div class="titles">${actionsHtml || '<span class="conf">No actions tagged yet.</span>'}</div>
    </section>

    <section class="place-sec">
      <h2>Why they went <span class="conf">— Place DNA (from ${creatorIds.length} visit${creatorIds.length === 1 ? "" : "s"}, small sample)</span></h2>
      <div class="dna">${dnaBars}</div>
    </section>

    <section class="place-sec">
      <h2>Similar vibe → you might also like</h2>
      <div class="titles">${simHtml}</div>
    </section>

    <section class="place-sec">
      <h2>How to get there</h2>
      <div class="get-there-btns">
        <a class="map-btn" href="https://www.google.com/maps/dir/Seoul+Station,+Seoul,+South+Korea/${encodeURIComponent((first.city || placeKey) + ', South Korea')}" target="_blank" rel="noopener">🗺 Route from Seoul (Google Maps) →</a>
        <a class="map-btn ghost-btn" href="https://search.naver.com/search.naver?query=${encodeURIComponent((first.city || placeKey) + ' 가는법 서울에서')}" target="_blank" rel="noopener">🔎 네이버 검색 →</a>
      </div>
      <button class="map-btn" id="save-btn" style="background:var(--accent-2);color:#fff;margin-top:10px;">❤ Save to my tribe</button>
      <p class="conf" id="save-note" style="margin-top:8px;"></p>
    </section>

    <section class="place-sec ratings-soon">
      <h2>Ratings <span class="conf">— coming with visitor feedback</span></h2>
      <p>We'll rate what actually matters for copying a creator's trip: <strong>easy to follow · transport from Seoul · photo recreatability · visitor satisfaction</strong>. We only show ratings we can back with real data — so these open once travellers start reporting back, not before.</p>
    </section>
  `;
  document.title = `${placeKey} — K-Drama Route`;

  // V16.5: the traveler adds this place to their tribe's memory (this device).
  const btn = document.getElementById("save-btn");
  const note = document.getElementById("save-note");
  const traveler = RR_MEM.traveler();
  const already = RR_MEM.saves().some((s) => s.place === placeKey);
  if (already) markSaved(btn, note, traveler);
  btn.addEventListener("click", () => {
    RR_MEM.addSave({ place: placeKey, city: first.city, region: first.region, identity: traveler ? traveler.identity : null });
    markSaved(btn, note, traveler);
  });
}

function markSaved(btn, note, traveler) {
  btn.textContent = "❤ Saved to your tribe";
  btn.disabled = true;
  btn.style.opacity = "0.7";
  note.innerHTML = traveler
    ? `Added to <a href="tribe.html?id=${encodeURIComponent(traveler.identity)}">${esc(traveler.identity)}</a>'s memory (this device). Pooled cross-traveler memory arrives with the backend.`
    : `Saved on this device. <a href="quiz.html">Take the quiz</a> to attach it to your tribe.`;
}

// ── scene strip ──────────────────────────────────────────────────────────
const MOMENT_ICON = {
  food: "🍜", culture: "🏛", walking: "🚶", sightseeing: "📸",
  transport: "🚇", nature: "🌿", shopping: "🛍", night: "🌙",
  historic: "🏯", people: "👥",
};

function ytId(url) {
  if (!url) return null;
  const m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function sceneStripHtml(v) {
  const id = ytId(v.videoUrl);
  if (!id) return "";
  const moments = Array.isArray(v.moments) ? v.moments.slice(0, 5) : [];
  // YouTube provides: maxresdefault (main) + 3 evenly-spaced auto-frames
  const srcs = [
    { url: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`, fb: `https://img.youtube.com/vi/${id}/hqdefault.jpg` },
    { url: `https://img.youtube.com/vi/${id}/1.jpg`, fb: null },
    { url: `https://img.youtube.com/vi/${id}/2.jpg`, fb: null },
    { url: `https://img.youtube.com/vi/${id}/3.jpg`, fb: null },
  ];
  const cuts = srcs.map(({ url, fb }, i) => {
    const m = moments[i];
    const cap = m ? `<p class="sc-cap">${MOMENT_ICON[m.type] || "✦"} ${esc(m.title)}</p>` : "";
    const err = fb
      ? `onerror="if(!this._fb){this._fb=1;this.src='${fb}'}else{this.parentElement.style.display='none'}"`
      : `onerror="this.parentElement.style.display='none'"`;
    const FRAME_PCT = [0, 0.25, 0.5, 0.75];
    const frameT = v.duration && i > 0 ? Math.floor(v.duration * FRAME_PCT[i]) : null;
    const href = m?.timestamp
      ? `${v.videoUrl}&t=${m.timestamp}`
      : frameT ? `${v.videoUrl}&t=${frameT}` : v.videoUrl;
    return `<div class="sc-cut"><a href="${href}" target="_blank" rel="noopener"><img src="${url}" alt="" loading="lazy" ${err} /></a>${cap}</div>`;
  }).join("");
  return `<div class="scene-strip">${cuts}</div>`;
}

// ── helpers (shared logic, kept local) ───────────────────────────────────
function groupAll(mode) {
  const keyOf = (v) => (mode === "city" ? v.city : v.place || v.city);
  const g = {};
  for (const v of DATA.visits || []) {
    const k = keyOf(v);
    if (!g[k]) g[k] = { label: k, creators: new Set(), reasons: {} };
    g[k].creators.add(v.creatorId);
    if (v.reason) g[k].reasons[v.reason] = (g[k].reasons[v.reason] || 0) + 1;
  }
  return Object.values(g).map((x) => ({ label: x.label, creatorIds: [...x.creators], reasons: x.reasons }));
}

// reasons-map for a list of visits → theme profile (via engine.themeProfile).
function reasonsMapOf(visits) {
  const reasons = {};
  for (const v of visits) if (v.reason) reasons[v.reason] = (reasons[v.reason] || 0) + 1;
  return reasons;
}
function profileOf(visits) {
  return themeProfile(reasonsMapOf(visits));
}
function similarPlaces(placeKey, visits, allPlaces) {
  const prof = profileOf(visits);
  return allPlaces
    .filter((p) => p.label !== placeKey)
    .map((p) => ({ label: p.label, sim: cosine(prof, themeProfile(p.reasons)) }))
    .filter((x) => x.sim > 0.3)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 3);
}

function fail(msg) {
  document.getElementById("place-body").innerHTML = `<p class="empty">${esc(msg)}</p>`;
}
function fmtSubs(n) {
  if (!n) return "";
  return n >= 1_000_000 ? (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M subs" : Math.round(n / 1000) + "K subs";
}
function fmtViews(n) {
  if (!n) return "—";
  return n >= 1_000_000 ? (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M" : (n / 1000).toFixed(0) + "K";
}
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
