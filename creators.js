// Creator DNA (V11): each creator's travel personality, computed from their
// verified visits — theme profile + dominant traveller archetype + where they went.
// Engine (themeProfile, dnaPercent, archetypeProfile) is shared via engine.js.

let DATA = { creators: [], visits: [] };

init();

async function init() {
  try {
    DATA = await (await fetch("data/visits.json")).json();
  } catch (e) {
    document.getElementById("creators").innerHTML = `<p class="empty">Could not load data.</p>`;
    return;
  }
  render();
}

function render() {
  const cards = (DATA.creators || [])
    .map((c) => {
      const visits = (DATA.visits || []).filter((v) => v.creatorId === c.id);
      if (!visits.length) return null;
      // V15: identity = which traveler archetype this creator embodies.
      const actVec = actionVector(visits.map((v) => `${v.spot || ""} ${v.reason || ""}`));
      const identity = identityOf(actVec)[0];
      // Cities as a journey path (most-viewed city first) — for the preview.
      const cityViews = {};
      for (const v of visits) { const k = v.city; if (k) cityViews[k] = (cityViews[k] || 0) + (Number(v.views) || 0); }
      const cities = Object.keys(cityViews).sort((a, b) => cityViews[b] - cityViews[a]);
      const totalViews = visits.reduce((a, v) => a + (Number(v.views) || 0), 0);
      const latest = visits.map((v) => v.uploaded || "").sort().pop() || ""; // newest upload (YYYY-MM)
      // Card thumbnail = their newest, then most-viewed video.
      const top = visits.filter((v) => v.videoUrl).sort(byRecentViews)[0];
      const topVideo = top ? { url: top.videoUrl, title: top.spot || "", id: ytId(top.videoUrl) } : null;
      return { c, identity, cities, totalViews, latest, topVideo };
    })
    .filter(Boolean)
    // Newest journeys first, then most-viewed.
    .sort((a, b) => (b.latest || "").localeCompare(a.latest || "") || b.totalViews - a.totalViews);

  const featured = cards[0];
  const rest = cards.slice(1);
  if (featured) document.getElementById("featured").innerHTML = featuredHtml(featured);
  document.getElementById("creators").innerHTML = rest.map(cardHtml).join("");
}

// Sort key: newest first (uploaded YYYY-MM), then most-viewed.
function byRecentViews(a, b) {
  return (b.uploaded || "").localeCompare(a.uploaded || "") || (b.views || 0) - (a.views || 0);
}

function pathOf(cities, n) {
  return cities.slice(0, n).map(esc).join("  →  ") + (cities.length > n ? "  →  …" : "");
}

// YouTube thumbnail: hi-res maxres with onerror fallback to the always-present hq.
function thumbImg(tv, cls) {
  if (!tv || !tv.id) return `<div class="${cls} creator-thumb--empty">🎬</div>`;
  const max = `https://img.youtube.com/vi/${tv.id}/maxresdefault.jpg`;
  const hq = `https://img.youtube.com/vi/${tv.id}/hqdefault.jpg`;
  return `<img class="${cls}" src="${max}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${hq}'" />`;
}

function featuredHtml(x) {
  const { c, identity, cities, topVideo } = x;
  const route = `route.html?creator=${encodeURIComponent(c.id)}`;
  return `
    <article class="featured-creator video-card">
      <a class="vc-thumb-link" href="${route}">${thumbImg(topVideo, "featured-thumb")}</a>
      <div class="featured-body">
        <p class="identity-pre">Follow how they experienced Korea</p>
        <h2>${esc(c.name)}'s Korea</h2>
        ${topVideo && topVideo.title ? `<p class="vc-title">“${esc(topVideo.title)}”</p>` : ""}
        <p class="journey-path">${pathOf(cities, 4)}</p>
        <div class="vc-actions">
          ${topVideo ? `<a class="map-btn ghost-btn" href="${topVideo.url}" target="_blank" rel="noopener">▶ Original video</a>` : ""}
          <a class="map-btn" href="${route}">🗺 Follow this journey →</a>
        </div>
      </div>
    </article>`;
}

function cardHtml(x) {
  const { c, identity, cities, topVideo } = x;
  const dominant = identity ? identity.name : "Explorer 🧭";
  const route = `route.html?creator=${encodeURIComponent(c.id)}`;
  return `
    <article class="card video-card">
      <a class="vc-thumb-link" href="${route}">${thumbImg(topVideo, "creator-thumb")}</a>
      <div class="vc-body">
        <span class="badge">${esc(c.country || "")}</span>
        <h3><a href="${route}">${esc(c.name)}'s Korea</a></h3>
        ${topVideo && topVideo.title ? `<p class="vc-title">“${esc(topVideo.title)}”</p>` : `<p class="archetype">${esc(dominant)}</p>`}
        <p class="journey-path">${pathOf(cities, 3)}</p>
        <div class="vc-actions">
          ${topVideo ? `<a class="map-btn ghost-btn" href="${topVideo.url}" target="_blank" rel="noopener">▶ Original</a>` : ""}
          <a class="map-btn" href="${route}">🗺 Follow journey</a>
        </div>
      </div>
    </article>`;
}

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
