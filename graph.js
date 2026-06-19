// V20: Identity Graph. The payoff of unifying Action→Emotion→Identity in ONE
// vector space — a place is just an action vector with a country label, so the
// same identity is matched to places in ANY country by cosine. Add a country's
// place profiles and it "just works"; the engine never hard-codes Korea.

let DATA = { creators: [], visits: [] };
let INTL = { places: [] };
let catalog = []; // [{place, country, vec, illustrative}]
let current = null; // identity name

init();

async function init() {
  try {
    DATA = await (await fetch("data/visits.json")).json();
    INTL = await (await fetch("data/places_intl.json")).json();
  } catch (e) {
    document.getElementById("graph-main").innerHTML = `<p class="empty">Could not load data.</p>`;
    return;
  }
  buildCatalog();
  buildIdentityFilters();
  const t = RR_MEM.traveler();
  current = (t && IDENTITIES.find((i) => i.name === t.identity)?.name) || IDENTITIES[0].name;
  render();
}

function buildCatalog() {
  // Korea: real creator visits → place action vectors.
  const byPlace = {};
  for (const v of DATA.visits || []) {
    const k = v.place || v.city;
    (byPlace[k] = byPlace[k] || []).push(`${v.spot || ""} ${v.reason || ""}`);
  }
  catalog = Object.entries(byPlace).map(([place, texts]) => ({ place, country: "Korea", vec: actionVector(texts), illustrative: false }));
  // International: illustrative manual profiles.
  for (const p of INTL.places || []) {
    const vec = {};
    for (const a of p.actions) vec[a] = (vec[a] || 0) + 1;
    catalog.push({ place: p.place, country: p.country, vec, illustrative: true });
  }
}

function buildIdentityFilters() {
  const el = document.getElementById("id-filters");
  el.innerHTML = IDENTITIES.map((i, n) => `<button class="chip ${n === 0 ? "active" : ""}" data-id="${esc(i.name)}">${esc(i.name)}</button>`).join("");
  el.querySelectorAll(".chip").forEach((btn) =>
    btn.addEventListener("click", () => {
      current = btn.dataset.id;
      el.querySelectorAll(".chip").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      render();
    })
  );
}

function render() {
  const id = IDENTITIES.find((i) => i.name === current);
  // sync active chip if entered via stored traveler
  document.querySelectorAll("#id-filters .chip").forEach((b) => b.classList.toggle("active", b.dataset.id === current));

  const ranked = catalog
    .map((c) => ({ ...c, sim: cosine(id.vec, c.vec) }))
    .filter((c) => c.sim > 0.2)
    .sort((a, b) => b.sim - a.sim);

  // V21: emotions the identity is really after (for the trace path).
  const idEmotions = dnaPercent(emotionProfile(id.vec)).slice(0, 2).map((e) => e.theme);

  const countries = [...new Set(ranked.map((r) => r.country))];
  const sections = countries
    .map((country) => {
      const rows = ranked.filter((r) => r.country === country).slice(0, 5);
      const items = rows
        .map((r) => {
          const link = r.illustrative ? "#" : `place.html?place=${encodeURIComponent(r.place)}&mode=place`;
          const badge = r.illustrative ? ' <em class="demo">illustrative</em>' : "";
          // V21 trace: which actions drove this match.
          const shared = sharedDimensions(id.vec, r.vec).map((d) => d.key);
          const path = [id.name, ...idEmotions, ...shared, r.place].map(esc).join(" → ");
          return `<div class="explain-row">
            <button class="explain-head" type="button">
              <span><a href="${link}">${esc(r.place)}</a>${badge}</span>
              <span class="sim">${Math.round(r.sim * 100)}% · why?</span>
            </button>
            <div class="explain-detail" hidden>
              <p class="trace">${path}</p>
              <p class="conf">Matched on shared actions: ${shared.map(esc).join(", ") || "—"}.</p>
            </div>
          </div>`;
        })
        .join("");
      return `<section class="place-sec"><h2>${flag(country)} ${esc(country)}</h2>${items}</section>`;
    })
    .join("");

  document.getElementById("graph-main").innerHTML = `
    <div class="identity-card" style="margin-bottom:24px;">
      <p class="identity-pre">Identity</p>
      <h2 class="identity-name">${esc(id.name)}</h2>
      <p class="identity-blurb">${esc(id.blurb)}</p>
    </div>
    ${sections}
    <p class="conf">Same identity vector, matched across countries by action profile. International = illustrative (not creator-verified).</p>`;

  // V21: expand a place to trace WHY it was recommended.
  document.querySelectorAll(".explain-head").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      if (e.target.tagName === "A") return; // let the place link work
      btn.nextElementSibling.hidden = !btn.nextElementSibling.hidden;
    })
  );
}

function flag(country) {
  return { Korea: "🇰🇷", Japan: "🇯🇵", Taiwan: "🇹🇼" }[country] || "📍";
}
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
