// V16: Tribes. An identity isn't just a label — it's a group you belong to.
// For each identity we show its member creators (classified in the shared action
// space) and where the tribe goes most. This is where the data center starts to
// shift from Creator DNA → Traveler DNA (traveler members need a backend, V17+).

let DATA = { creators: [], visits: [] };
let creatorById = {};

init();

async function init() {
  try {
    DATA = await (await fetch("data/visits.json")).json();
  } catch (e) {
    document.getElementById("tribe-main").innerHTML = `<p class="empty">Could not load data.</p>`;
    return;
  }
  creatorById = Object.fromEntries((DATA.creators || []).map((c) => [c.id, c]));

  const id = new URLSearchParams(location.search).get("id");
  if (id) renderTribe(id);
  else renderOverview();
}

// creatorId -> identity name (classified in action space)
function creatorIdentity(cid) {
  const vs = (DATA.visits || []).filter((v) => v.creatorId === cid);
  if (!vs.length) return null;
  const vec = actionVector(vs.map((v) => `${v.spot || ""} ${v.reason || ""}`));
  return identityOf(vec)[0].name;
}

function membersOf(identityName) {
  return (DATA.creators || []).filter((c) => creatorIdentity(c.id) === identityName);
}

// places the tribe goes most: place -> # of member creators who went.
function tribePlaces(members) {
  const ids = new Set(members.map((m) => m.id));
  const byPlace = {};
  for (const v of DATA.visits || []) {
    if (!ids.has(v.creatorId)) continue;
    const k = v.place || v.city;
    (byPlace[k] = byPlace[k] || new Set()).add(v.creatorId);
  }
  return Object.entries(byPlace)
    .map(([label, set]) => ({ label, n: set.size }))
    .sort((a, b) => b.n - a.n);
}

function renderOverview() {
  document.getElementById("tribe-title").innerHTML = "Travel Tribes";
  const cards = IDENTITIES.map((id) => {
    const members = membersOf(id.name);
    const top = tribePlaces(members).slice(0, 3).map((p) => p.label);
    return `
      <a class="card" href="tribe.html?id=${encodeURIComponent(id.name)}">
        <h3>${esc(id.name)}</h3>
        <p class="desc">${esc(id.blurb)}</p>
        <p class="rank-stats">${members.length} creator member${members.length === 1 ? "" : "s"}${top.length ? " · goes to " + esc(top.join(", ")) : ""}</p>
      </a>`;
  }).join("");
  // V16.8: emerging tribes discovered by clustering creator action vectors.
  const entities = (DATA.creators || [])
    .map((c) => {
      const vs = (DATA.visits || []).filter((v) => v.creatorId === c.id);
      return vs.length ? { label: c.name, vec: actionVector(vs.map((v) => `${v.spot || ""} ${v.reason || ""}`)) } : null;
    })
    .filter(Boolean);
  const emerging = discoverTribes(entities);
  const emergingHtml = emerging.length
    ? emerging
        .map(
          (t) => `<div class="card">
            <h3>${esc(t.name)} <span class="conf">discovered</span></h3>
            <p class="desc">${t.topActions.map(esc).join(" · ")}</p>
            <p class="rank-stats">${t.members.map((m) => esc(m.label)).join(", ")}</p>
          </div>`
        )
        .join("")
    : `<p class="conf">No clusters yet — needs more travelers.</p>`;

  document.getElementById("tribe-main").innerHTML = `
    <h2 style="margin:0 0 14px;">Curated tribes <span class="conf">— top-down, we named these</span></h2>
    <div class="grid">${cards}</div>
    <h2 style="margin:34px 0 6px;">🔬 Emerging tribes <span class="conf">— bottom-up, discovered by clustering behavior</span></h2>
    <p class="conf" style="margin:0 0 14px;">Found by clustering creator action vectors in the seed data. Real emergent tribes (with names no one assigned) form once thousands of traveler logs accumulate — that's the moat.</p>
    <div class="grid">${emergingHtml}</div>`;
}

function renderTribe(identityName) {
  const id = IDENTITIES.find((x) => x.name === identityName);
  if (!id) return renderOverview();
  document.getElementById("tribe-title").innerHTML = esc(id.name);
  document.getElementById("tribe-sub").textContent = id.blurb;

  const members = membersOf(id.name);
  const places = tribePlaces(members);

  const memberHtml = members.length
    ? members.map((c) => `<a class="match" href="${c.url}" target="_blank" rel="noopener"><strong>${esc(c.name)}</strong><span>${esc(c.country || "")}</span></a>`).join("")
    : `<span class="conf">No creators classified here yet.</span>`;

  const placeHtml = places.length
    ? places.map((p) => `<a class="tag" href="place.html?place=${encodeURIComponent(p.label)}&mode=place">${esc(p.label)} <em>${p.n}</em></a>`).join(" ")
    : `<span class="conf">No places yet.</span>`;

  // V16.5: this traveler's own saved places — the inverted flow (Traveler → Tribe).
  const traveler = RR_MEM.traveler();
  const isYou = traveler && traveler.identity === id.name;
  const mySaves = RR_MEM.savesFor(id.name);
  const mySavesHtml = mySaves.length
    ? `<section class="place-sec"><h2>Your saved spots <span class="conf">— this device; pools with all travelers via backend (V17)</span></h2>
        <div class="titles">${mySaves.map((s) => `<a class="tag" href="place.html?place=${encodeURIComponent(s.place)}&mode=place">${esc(s.place)}</a>`).join(" ")}</div></section>`
    : "";

  document.getElementById("tribe-main").innerHTML = `
    ${isYou ? `<p class="conf" style="font-size:0.95rem;color:var(--accent-2);">★ This is your tribe.</p>` : ""}
    <section class="place-sec">
      <h2>Your tribe <span class="conf">— ${members.length} creator member${members.length === 1 ? "" : "s"} (travelers join with the backend)</span></h2>
      <div class="match-list">${memberHtml}</div>
    </section>
    <section class="place-sec">
      <h2>Where your tribe goes most</h2>
      <div class="titles">${placeHtml}</div>
    </section>
    ${mySavesHtml}
    <section class="place-sec ratings-soon">
      <h2>Tribe packages <span class="conf">— next (V17)</span></h2>
      <p>Once the tribe has a route, the revenue follows it: a <strong>${esc(id.name)}</strong> course, stays and tours bundled for how this tribe actually travels. And traveler members (not just creators) join the count once quiz results are stored.</p>
    </section>
  `;
}

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
