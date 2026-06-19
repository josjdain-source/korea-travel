// Global-interest ranking. Ranks Korean cities by how many distinct FOREIGN
// creators visited them, weighted by reach — computed live from data/visits.json.
// Ranks are never hardcoded; add verified visits and the ranking re-derives itself.

const BIG_CITIES = ["Seoul", "Busan", "Jeju"];

let DATA = { creators: [], visits: [] };
let creatorById = {};
let TRENDS = {};
const PICK_DESC = {
  all:      "해외 + 한국 크리에이터 전체 기준",
  global:   "외국인 크리에이터가 실제로 방문한 장소",
  local:    "한국 크리에이터가 추천하는 장소",
  verified: "외국인 + 한국인 크리에이터 모두 언급한 검증 장소",
};

let state = { region: "all", hideBig: false, mode: "place", experience: "all", action: null, pick: "all" };

const rankingEl = document.getElementById("ranking");
const emptyState = document.getElementById("empty-state");
const resultCount = document.getElementById("result-count");
const regionFilters = document.getElementById("region-filters");
const expFilters = document.getElementById("exp-filters");

init();

async function init() {
  const _p = new URLSearchParams(location.search);
  state.action = _p.get("action"); // V6: browse by action
  if (_p.get("exp")) state.experience = _p.get("exp"); // homepage category → theme filter
  try {
    DATA = await (await fetch("data/visits.json")).json();
  } catch (e) {
    DATA = { creators: [], visits: [] };
  }
  try {
    const td = await (await fetch("data/trends.json")).json();
    TRENDS = td.places || {};
  } catch (_) { /* trends optional — no badge if missing */ }
  creatorById = Object.fromEntries((DATA.creators || []).map((c) => [c.id, c]));
  renderStats();
  buildExperienceFilters();
  buildRegionFilters();
  bindControls();
  render();
}

// Real, computed stats — never aspirational placeholders.
function renderStats() {
  const el = document.getElementById("stats");
  if (!el) return;
  const creators = (DATA.creators || []).length;
  const places = new Set((DATA.visits || []).map((v) => v.place || v.city)).size;
  const videos = (DATA.visits || []).filter((v) => v.videoUrl).length;
  el.innerHTML = `🎥 <strong>${creators}</strong> global creators &nbsp;·&nbsp; 📍 <strong>${places}</strong> places &nbsp;·&nbsp; 👣 <strong>${videos}</strong> real visits <span class="conf">(seed dataset — growing)</span>`;
}

// Aggregate visits → one row per place (or per city, depending on mode).
function aggregate() {
  const keyOf = (v) => (state.mode === "place" ? v.place || v.city : v.city);
  const groups = {};
  for (const v of DATA.visits || []) {
    const key = keyOf(v);
    if (!groups[key]) {
      groups[key] = {
        label: key, city: v.city, region: v.region,
        creators: new Set(), globalCreators: new Set(), localCreators: new Set(),
        reasons: {}, actions: new Set(), totalViews: 0, sceneCount: 0, latestUpload: "",
        recentVisits: [],
      };
    }
    const g = groups[key];
    const c = creatorById[v.creatorId];
    g.creators.add(v.creatorId);
    if (c && c.country === "KR") g.localCreators.add(v.creatorId);
    else g.globalCreators.add(v.creatorId);
    g.totalViews += Number(v.views) || 0;
    g.sceneCount += (v.moments || []).length;
    if (v.reason) g.reasons[v.reason] = (g.reasons[v.reason] || 0) + 1;
    for (const act of actionsOf(`${v.spot || ""} ${v.reason || ""}`)) g.actions.add(act);
    if (v.uploaded && v.uploaded > g.latestUpload) g.latestUpload = v.uploaded;
    g.recentVisits.push({ creatorId: v.creatorId, uploaded: v.uploaded || "" });
  }
  let rows = Object.values(groups).map((g) => {
    const gc = g.globalCreators.size, lc = g.localCreators.size;
    const verifiedBonus = gc > 0 && lc > 0 ? 20 : 0;
    // Recent creators: deduplicated, sorted by upload date descending, top 3
    const seen = new Set();
    const recentCreators = g.recentVisits
      .filter(v => creatorById[v.creatorId])
      .sort((a, b) => b.uploaded.localeCompare(a.uploaded))
      .reduce((acc, v) => {
        if (!seen.has(v.creatorId)) { seen.add(v.creatorId); acc.push(v.creatorId); }
        return acc;
      }, [])
      .slice(0, 3);
    return {
      label: g.label, city: g.city, region: g.region,
      creatorCount: g.creators.size,
      creatorIds: [...g.creators],
      globalCreatorCount: gc, globalCreatorIds: [...g.globalCreators],
      localCreatorCount: lc,  localCreatorIds: [...g.localCreators],
      totalViews: g.totalViews,
      sceneCount: g.sceneCount,
      isVerified: gc > 0 && lc > 0,
      reasonCounts: g.reasons,
      actions: [...g.actions],
      topReasons: Object.entries(g.reasons).sort((a, b) => b[1] - a[1]).map(([k]) => k),
      latestUpload: g.latestUpload,
      recentCreators,
      score: (gc + lc) * 10 + g.sceneCount * 5 + verifiedBonus,
    };
  });
  rows.sort((a, b) => b.score - a.score);
  return rows;
}

// Experience Gap: positive = creators visit more than search volume suggests (hidden gem).
function computeGaps(rows) {
  const withScore = rows
    .map(r => ({ label: r.label, score: (TRENDS[r.label] || TRENDS[r.city] || { score: 0 }).score }))
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score);
  const searchRankOf = {};
  withScore.forEach((p, i) => { searchRankOf[p.label] = i + 1; });
  const gaps = {};
  rows.forEach((r, i) => {
    const sr = searchRankOf[r.label];
    if (sr !== undefined) gaps[r.label] = sr - (i + 1);
  });
  return gaps;
}

// Theme/action vocab + scoring (themesOf, actionsOf, themeProfile, dnaPercent,
// cosine) live in engine.js, loaded before this file and shared with place.js.

function buildExperienceFilters() {
  if (!expFilters) return;
  const themes = new Set();
  for (const v of DATA.visits || []) for (const t of themesOf(v.reason)) themes.add(t);
  const list = ["all", ...[...themes].sort()];
  expFilters.innerHTML = list
    .map((t) => `<button class="chip ${t === state.experience ? "active" : ""}" data-exp="${esc(t)}">${t === "all" ? "Anything" : esc(t)}</button>`)
    .join("");
  expFilters.querySelectorAll(".chip").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.experience = btn.dataset.exp;
      expFilters.querySelectorAll(".chip").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      render();
    })
  );
}

function buildRegionFilters() {
  const regions = ["all", ...new Set((DATA.visits || []).map((v) => v.region).filter(Boolean))];
  regionFilters.innerHTML = regions
    .map((r) => `<button class="chip ${r === "all" ? "active" : ""}" data-region="${r}">${r === "all" ? "All regions" : esc(r)}</button>`)
    .join("");
  regionFilters.querySelectorAll(".chip").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.region = btn.dataset.region;
      regionFilters.querySelectorAll(".chip").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      render();
    })
  );
}

function bindControls() {
  document.getElementById("hide-big").addEventListener("change", (e) => {
    state.hideBig = e.target.checked;
    render();
  });
  const modeGroup = document.getElementById("mode-toggle");
  if (modeGroup) {
    modeGroup.querySelectorAll(".chip").forEach((btn) =>
      btn.addEventListener("click", () => {
        state.mode = btn.dataset.mode;
        modeGroup.querySelectorAll(".chip").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        render();
      })
    );
  }
  const pickGroup = document.getElementById("pick-tabs");
  if (pickGroup) {
    pickGroup.querySelectorAll(".chip").forEach((btn) =>
      btn.addEventListener("click", () => {
        state.pick = btn.dataset.pick;
        pickGroup.querySelectorAll(".chip").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const descEl = document.getElementById("pick-desc");
        if (descEl) descEl.textContent = PICK_DESC[state.pick] || "";
        render();
      })
    );
  }
}

function render() {
  let rows = aggregate();
  if (state.pick === "global")   rows = rows.filter((r) => r.globalCreatorCount > 0);
  if (state.pick === "local")    rows = rows.filter((r) => r.localCreatorCount > 0);
  if (state.pick === "verified") rows = rows.filter((r) => r.isVerified);
  if (state.region !== "all") rows = rows.filter((r) => r.region === state.region);
  if (state.hideBig) rows = rows.filter((r) => !BIG_CITIES.includes(r.city));
  if (state.experience !== "all") rows = rows.filter((r) => themeProfile(r.reasonCounts)[state.experience]);
  if (state.action) rows = rows.filter((r) => r.actions.includes(state.action));

  if (!rows.length) {
    rankingEl.innerHTML = "";
    resultCount.textContent = "";
    const hasFilter = state.pick !== "all" || state.region !== "all" || state.experience !== "all" || state.action;
    document.getElementById("empty-title").textContent = hasFilter
      ? "No results for this filter combination."
      : "The dataset is still being built.";
    document.getElementById("empty-msg").textContent =
      state.pick === "local"    ? "한국 크리에이터 데이터가 아직 없습니다. 곧 추가됩니다." :
      state.pick === "verified" ? "외국인 + 한국인 크리에이터 모두 방문한 장소가 아직 없습니다." :
      hasFilter ? `No verified creator visits match this filter combination yet. Try clearing some filters.` :
      "Rankings appear automatically as verified creator visits are added.";
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;
  resultCount.innerHTML = state.action
    ? `Places where creators: <strong>${esc(state.action)}</strong> — ${rows.length} found &nbsp;<a href="ranking.html" style="color:var(--accent-2)">clear ✕</a>`
    : `${rows.length} place${rows.length === 1 ? "" : "s"} ranked by global creator interest`;

  const maxCreators = Math.max(...rows.map((r) => r.creatorCount));
  const gaps = computeGaps(rows);
  rankingEl.innerHTML = rows.map((r, i) => rowHtml(r, i + 1, maxCreators, gaps[r.label])).join("");
  // Click a row → that place's detail page.
  rankingEl.querySelectorAll(".rank-row").forEach((el) =>
    el.addEventListener("click", () => {
      location.href = `place.html?place=${encodeURIComponent(el.dataset.place)}&mode=${state.mode}`;
    })
  );
}

function rowHtml(r, rank, maxCreators, gap) {
  const stars = "★".repeat(Math.max(1, Math.round((r.creatorCount / maxCreators) * 5))).padEnd(5, "☆");
  const sub = state.mode === "place" && r.label !== r.city ? `${esc(r.city)} · ${esc(r.region || "")}` : esc(r.region || "");

  // ── Main headline: creator count + reach (the primary data asset)
  const viewsStr = r.totalViews >= 1_000_000
    ? (r.totalViews / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
    : r.totalViews >= 1000 ? Math.round(r.totalViews / 1000) + "K" : String(r.totalViews);
  const gcLabel = r.globalCreatorCount > 0
    ? `${r.globalCreatorCount} foreign creator${r.globalCreatorCount !== 1 ? "s" : ""}`
    : "";
  const lcLabel = r.localCreatorCount > 0
    ? `${r.localCreatorCount} Korean creator${r.localCreatorCount !== 1 ? "s" : ""}`
    : "";
  const creatorSummary = [gcLabel, lcLabel].filter(Boolean).join(" · ");
  const uploadLabel = r.latestUpload ? ` · <span class="upload-date">📅 ${fmtUpload(r.latestUpload)}</span>` : "";

  // ── Experience Gap badge (the differentiator)
  let gapHtml = "";
  if (gap !== undefined && Math.abs(gap) >= 6) {
    if (gap >= 6) {
      gapHtml = `<span class="gap-badge gap-hidden" title="Creators visit this place far more than search volume suggests">🔍 Hidden Gem</span>`;
    } else {
      gapHtml = `<span class="gap-badge gap-tourist" title="High search interest, fewer creator visits">📢 Tourist Hotspot</span>`;
    }
  }

  // ── Verified badge
  const verifiedBadge = r.isVerified ? `<span class="verified-badge">✓ Verified</span>` : "";

  // ── Recent visitors (primary names, not just tags)
  const recentNames = (r.recentCreators || [])
    .map(id => creatorById[id])
    .filter(Boolean)
    .map(c => `<span class="recent-name">${esc(c.name)}</span>`)
    .join("");
  const recentHtml = recentNames
    ? `<div class="recent-visitors">Recent: ${recentNames}</div>`
    : "";

  // ── All creator tags (expandable detail)
  const globalTags = r.globalCreatorIds.map((id) => creatorById[id]).filter(Boolean)
    .map((c) => `<span class="tag tag-global" title="${esc(c.country || "")} · ${fmtSubs(c.subscribers)}">${esc(c.name)}</span>`).join(" ");
  const localTags = r.localCreatorIds.map((id) => creatorById[id]).filter(Boolean)
    .map((c) => `<span class="tag tag-local" title="${esc(c.country || "")} · ${fmtSubs(c.subscribers)}">${esc(c.name)}</span>`).join(" ");
  const creatorTags = state.pick === "local" ? localTags
    : state.pick === "global" ? globalTags
    : globalTags + (localTags ? ` <span class="tag-sep">·</span> ` + localTags : "");

  const actions = (r.actions || []).slice(0, 4).map((a) => `<span class="reason">${esc(a)}</span>`).join("");

  // ── Google Trends: secondary indicator, small
  const td = TRENDS[r.label] || TRENDS[r.city] || null;
  const trendLine = td && td.score > 0
    ? `<span class="trend-secondary">${td.trend === "rising" ? "🔥" : td.trend === "up" ? "↑" : "—"} Google Trends ${td.delta > 0 ? "+" + td.delta : td.delta}%</span>`
    : "";

  return `
    <li class="rank-row${BIG_CITIES.includes(r.city) ? " big" : ""}${r.isVerified ? " verified" : ""}" data-place="${esc(r.label)}">
      <div class="rank-num">${rank}</div>
      <div class="rank-body">
        <div class="rank-head">
          <h3>${esc(r.label)}${verifiedBadge}${gapHtml}<span class="region">${sub}</span></h3>
          <span class="stars" title="Creator interest score: ${r.score}">${stars}</span>
        </div>
        <p class="rank-stats">${creatorSummary} · <strong>${viewsStr} views</strong> · ${r.sceneCount} scene${r.sceneCount !== 1 ? "s" : ""}${uploadLabel}</p>
        ${recentHtml}
        ${trendLine ? `<p class="rank-trend">${trendLine}</p>` : ""}
        ${actions ? `<div class="reasons">Creators here: ${actions} <span class="expand-hint">▸ details</span></div>` : `<div class="reasons"><span class="expand-hint">▸ see who went &amp; how to follow</span></div>`}
        ${creatorTags ? `<div class="titles">${creatorTags}</div>` : ""}
      </div>
    </li>`;
}

function fmtUpload(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const label = months[parseInt(m, 10) - 1] || m;
  return `${label} ${y}`;
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
