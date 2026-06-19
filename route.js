// Creator Route — the people-first click target. "Follow [creator]'s Korea":
// the exact spots they featured, the real clip, and how to get there. Places are
// the destination of the flow (creator → video → place → route), not the entry.

let DATA = { creators: [], visits: [] };

init();

async function init() {
  const id = new URLSearchParams(location.search).get("creator");
  try {
    DATA = await (await fetch("data/visits.json")).json();
  } catch (e) {
    return fail("Could not load data.");
  }
  const c = (DATA.creators || []).find((x) => x.id === id);
  if (!c) return fail("Creator not found.");
  const visits = (DATA.visits || []).filter((v) => v.creatorId === id);
  if (!visits.length) return fail("No spots for this creator yet.");
  render(c, visits);
  if (typeof RR_MEM !== "undefined") RR_MEM.logEvent("creator_route", { place: null, identity_after: identityOfCreator(visits).name });
}

function identityOfCreator(visits) {
  return identityOf(actionVector(visits.map((v) => `${v.spot || ""} ${v.reason || ""}`)))[0];
}

function render(c, visits) {
  const ident = identityOfCreator(visits);
  // Order spots: newest first, then most-watched.
  const stops = visits.slice().sort((a, b) => (b.uploaded || "").localeCompare(a.uploaded || "") || (b.views || 0) - (a.views || 0));

  const stopsHtml = stops.map((v, i) => stopHtml(v, i)).join("");

  // "More in this creator's style" — places they DIDN'T go that match their vector.
  const cVec = actionVector(visits.map((v) => `${v.spot || ""} ${v.reason || ""}`));
  const went = new Set(visits.map((v) => v.place || v.city));
  const byPlace = {};
  for (const v of DATA.visits || []) {
    const k = v.place || v.city;
    if (went.has(k)) continue;
    (byPlace[k] = byPlace[k] || []).push(`${v.spot || ""} ${v.reason || ""}`);
  }
  const similar = Object.entries(byPlace)
    .map(([place, texts]) => ({ place, sim: cosine(cVec, actionVector(texts)) }))
    .filter((x) => x.sim > 0.3)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 4);
  const simHtml = similar.length
    ? similar.map((s) => `<a class="tag" href="place.html?place=${encodeURIComponent(s.place)}&mode=place">${esc(s.place)} <em>${Math.round(s.sim * 100)}%</em></a>`).join(" ")
    : `<span class="conf">—</span>`;

  const cityPath = [...new Set(stops.map((v) => v.city).filter(Boolean))].map(esc).join("  →  ");

  // Collect all moment pins with coordinates for the journey map.
  const pins = [];
  for (const v of stops) {
    for (const m of (v.moments || [])) {
      if (m.place && m.place.lat && m.place.lng) {
        pins.push({ lat: m.place.lat, lng: m.place.lng, type: m.type, title: m.title, placeName: m.place.name });
      }
    }
  }

  // The source video is the hero — this journey came from a real clip.
  const hero = stops.find((v) => v.videoUrl);
  const heroId = hero ? ytId(hero.videoUrl) : null;
  const heroHtml = heroId
    ? `<a class="source-video" href="${hero.videoUrl}" target="_blank" rel="noopener">
         <img src="https://img.youtube.com/vi/${heroId}/maxresdefault.jpg" onerror="this.onerror=null;this.src='https://img.youtube.com/vi/${heroId}/hqdefault.jpg'" alt="" />
         <span class="source-play">▶</span>
         <span class="source-cap">This journey came from ${esc(c.name)}'s video${hero.spot ? ` — "${esc(hero.spot)}"` : ""}</span>
       </a>`
    : "";

  const journeyMapHtml = pins.length
    ? `<section class="place-sec">
        <h2>Where they went</h2>
        <div id="journey-map"></div>
      </section>`
    : "";

  document.getElementById("route-body").innerHTML = `
    <header class="place-head">
      <p class="identity-pre">Follow how they experienced Korea</p>
      <h1>${esc(c.name)}'s Korea</h1>
      <p class="archetype">${esc(ident.name)}</p>
      ${cityPath ? `<p class="journey-path">${cityPath}</p>` : ""}
    </header>
    ${heroHtml}
    ${journeyMapHtml}
    <section class="place-sec">
      <h2>${esc(c.name)}'s Korea, stop by stop</h2>
      ${stopsHtml}
      <p class="conf">These are the spots ${esc(c.name)} featured — not a fixed day-by-day schedule. Chain them into your own trip in any order.</p>
    </section>
    <section class="place-sec">
      <h2>If you liked their vibe →</h2>
      <div class="titles">${simHtml}</div>
    </section>
    <section class="place-sec ratings-soon">
      <h2>Make it your trip <span class="conf">— coming</span></h2>
      <p>This page turns a video into a real trip — so booking lives here, not on a place page: <strong>KTX between these stops · stays · a guided version of ${esc(c.name)}'s journey</strong>.</p>
    </section>`;
  document.title = `${c.name}'s Korea — K-Drama Route`;

  if (pins.length) initJourneyMap(pins);
}

function initJourneyMap(pins) {
  const map = L.map("journey-map");
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  const bounds = pins.map((p) => [p.lat, p.lng]);
  pins.forEach((p) => {
    const icon = L.divIcon({
      html: TYPE_ICON[p.type] || "📍",
      className: "exp-pin",
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18],
    });
    L.marker([p.lat, p.lng], { icon })
      .addTo(map)
      .bindPopup(
        `<strong>${esc(p.title)}</strong>` +
        (p.placeName ? `<br>📍 ${esc(p.placeName)}` : "")
      );
  });

  if (bounds.length === 1) {
    map.setView(bounds[0], 15);
  } else {
    map.fitBounds(bounds, { padding: [40, 40] });
  }
}

// ── Stop rendering ──────────────────────────────────────────────────────────

function stopHtml(v, i) {
  const place = v.place || v.city;
  const num = String(i + 1).padStart(2, "0");
  if (v.moments && v.moments.length) return journeyStopHtml(v, num, place);
  // Fallback: simple card (no moment data yet)
  const thumb = ytThumb(v.videoUrl);
  const thumbHtml = thumb ? `<img class="stop-thumb" src="${thumb}" alt="" loading="lazy" onerror="this.style.display='none'" />` : "";
  const did = (typeof actionsOf === "function" ? actionsOf(`${v.spot || ""} ${v.reason || ""}`) : []).slice(0, 3).join(" · ");
  return `
    <div class="stop">
      <div class="stop-num">${num}</div>
      <div class="stop-main">
        ${thumbHtml}
        <div class="stop-body">
          <h3>${esc(place)} <span class="region">${esc(v.city || "")}</span></h3>
          ${v.reason ? `<p class="stop-why"><strong>Why they went:</strong> ${esc(v.reason)}</p>` : ""}
          ${did ? `<p class="stop-did"><strong>What they did:</strong> ${esc(did)}</p>` : ""}
          <div class="stop-actions">
            ${v.videoUrl ? `<a class="map-btn" href="${v.videoUrl}" target="_blank" rel="noopener">▶ Watch the moment</a>` : ""}
            <a class="map-btn ghost-btn" href="place.html?place=${encodeURIComponent(place)}&mode=place">📍 How to get there</a>
          </div>
        </div>
      </div>
    </div>`;
}

// Journey Timeline — rendered when a visit has curated moments
function journeyStopHtml(v, num, place) {
  const id = v.videoUrl ? ytId(v.videoUrl) : null;
  const videoHtml = id ? `
    <a class="journey-video-thumb" href="${v.videoUrl}" target="_blank" rel="noopener">
      <img src="https://img.youtube.com/vi/${id}/maxresdefault.jpg"
           onerror="this.onerror=null;this.src='https://img.youtube.com/vi/${id}/hqdefault.jpg'" alt="" />
      <span class="jvt-play">▶</span>
      <span class="jvt-label">Source video</span>
    </a>` : "";
  const timelineHtml = v.moments.map((m, mi) => {
    const isLast = mi === v.moments.length - 1;
    const transit = !isLast ? calcTransit(m, v.moments[mi + 1]) : null;
    return momentHtml(m, mi, isLast, transit);
  }).join("");
  return `
    <div class="stop journey-stop">
      <div class="stop-num">${num}</div>
      <div class="stop-main journey-main">
        <div class="journey-stop-head">
          <div>
            <h3>${esc(place)} <span class="region">${esc(v.city || "")}</span></h3>
            <p class="journey-moment-count">${v.moments.length} captured moment${v.moments.length === 1 ? "" : "s"}</p>
          </div>
          ${videoHtml}
        </div>
        <div class="journey-timeline">
          ${timelineHtml}
        </div>
      </div>
    </div>`;
}

const TYPE_ICON = {
  walking: "🚶", food: "🍜", culture: "👘", sightseeing: "🏯",
  photo: "📸", nature: "🌿", cafe: "☕", drinking: "🍺", shopping: "🛍️"
};
const TYPE_COLOR = {
  walking: "#3d8b5a", food: "#d2691e", culture: "#8e3b5e", sightseeing: "#3c6585",
  photo: "#7b5ea7", nature: "#3d8b5a", cafe: "#8c6244", drinking: "#4a7c8e", shopping: "#c47a3a"
};
const TYPE_ACTION = {
  food: "먹기", walking: "걷기", culture: "체험", sightseeing: "탐방",
  photo: "촬영", nature: "자연 감상", cafe: "휴식", drinking: "마시기", shopping: "쇼핑"
};

function momentHtml(m, stepIndex, isLast, transit) {
  const icon = TYPE_ICON[m.type] || "📍";
  const color = TYPE_COLOR[m.type] || "#5a7a8a";
  const mp = m.place;
  const mapUrl = mp
    ? (mp.lat && mp.lng
        ? `https://www.google.com/maps?q=${mp.lat},${mp.lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((mp.name || "") + " South Korea")}`)
    : null;
  const emotions = (m.emotion || []).map((e) => `<span class="m-tag">${esc(e)}</span>`).join("");
  const replayHtml = [];
  if (m.replay) {
    if (m.replay.cost) replayHtml.push(`<span class="replay-chip rc-cost">💰 ${esc(m.replay.cost)}</span>`);
    if (m.replay.duration) replayHtml.push(`<span class="replay-chip rc-dur">⏱ ${esc(m.replay.duration)}</span>`);
    if (m.replay.tip) replayHtml.push(`<span class="replay-chip rc-tip">💡 ${esc(m.replay.tip)}</span>`);
  }
  const transitStr = transit
    ? `<div class="transit-next">${transit.icon} ${transit.mode} 약 ${transit.minutes}분${transit.distStr ? ` · ${transit.distStr}` : ""}</div>`
    : "";
  return `
    <div class="moment-entry${isLast ? " last" : ""}">
      <div class="moment-left">
        <div class="moment-icon-tile" style="background:${color}22;border-color:${color}44;color:${color}">${icon}</div>
        ${!isLast ? `<div class="moment-vline"></div>` : ""}
      </div>
      <div class="moment-content">
        <div class="moment-meta">
          <span class="moment-step-num">${circled(stepIndex)}</span>
          <span class="moment-type">${esc(TYPE_ACTION[m.type] || m.type || "")}</span>
        </div>
        <h4 class="moment-title">${esc(m.title)}</h4>
        <p class="moment-desc">${esc(m.description)}</p>
        ${mp && mp.name ? `<div class="moment-loc">
          <span>📍 ${esc(mp.name)}</span>
          ${mapUrl ? `<a class="moment-map-btn" href="${mapUrl}" target="_blank" rel="noopener">Open map ↗</a>` : ""}
        </div>` : ""}
        ${emotions ? `<div class="moment-emotions">${emotions}</div>` : ""}
        ${replayHtml.length ? `<div class="replay-chips">${replayHtml.join("")}</div>` : ""}
        ${transitStr}
      </div>
    </div>`;
}

const CIRCLED_NUMS = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩"];
function circled(n) { return CIRCLED_NUMS[n] || `(${n + 1})`; }

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcTransit(fromM, toM) {
  const fp = fromM.place, tp = toM.place;
  if (!fp || !tp || !fp.lat || !fp.lng || !tp.lat || !tp.lng) return null;
  const km = haversine(fp.lat, fp.lng, tp.lat, tp.lng);
  if (km < 0.05) return null;
  let icon, mode, minutes;
  if (km < 1.5) {
    icon = "🚶"; mode = "도보"; minutes = Math.max(1, Math.round(km * 1000 / 80));
  } else if (km < 15) {
    icon = "🚌"; mode = "대중교통"; minutes = Math.round(km * 60 / 20);
  } else {
    icon = "🚕"; mode = "차량 이동"; minutes = Math.round(km * 60 / 30);
  }
  const distStr = km < 1 ? `약 ${Math.round(km * 1000)}m` : `약 ${km.toFixed(1)}km`;
  return { icon, mode, minutes, distStr };
}

function fail(msg) {
  document.getElementById("route-body").innerHTML = `<p class="empty">${esc(msg)}</p>`;
}
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
