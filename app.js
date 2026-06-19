// K-Drama Route — static front-end. Data lives in data/locations.json.

let LOCATIONS = [];
let state = { search: "", region: "all", category: "all" };

const grid = document.getElementById("grid");
const empty = document.getElementById("empty");
const resultCount = document.getElementById("result-count");
const regionFilters = document.getElementById("region-filters");

init();

async function init() {
  try {
    const res = await fetch("data/locations.json");
    LOCATIONS = await res.json();
  } catch (e) {
    grid.innerHTML = `<p class="empty">Could not load locations data.</p>`;
    return;
  }
  buildRegionFilters();
  bindControls();
  render();
}

function buildRegionFilters() {
  const regions = ["all", ...new Set(LOCATIONS.map((l) => l.region))];
  regionFilters.innerHTML = regions
    .map(
      (r) =>
        `<button class="chip ${r === "all" ? "active" : ""}" data-region="${r}">${
          r === "all" ? "All regions" : escapeHtml(r)
        }</button>`
    )
    .join("");
  regionFilters.querySelectorAll(".chip").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.region = btn.dataset.region;
      setActive(regionFilters, btn);
      render();
    })
  );
}

function bindControls() {
  document.getElementById("search").addEventListener("input", (e) => {
    state.search = e.target.value.trim().toLowerCase();
    render();
  });
  const catGroup = document.getElementById("category-filters");
  catGroup.querySelectorAll(".chip").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.category = btn.dataset.category;
      setActive(catGroup, btn);
      render();
    })
  );
  // "Seen it on Instagram?" link resolver
  document.getElementById("link-form").addEventListener("submit", onResolve);
  // Modal close
  document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

function setActive(group, btn) {
  group.querySelectorAll(".chip").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
}

// ── Content → reality converter ──────────────────────────────────────────
// Today this matches the pasted link/description against our known locations
// by keyword. In the live version, a video-understanding model would watch the
// actual clip and pinpoint the spot — replace matchContent() with that call.
function matchContent(text) {
  const q = decodeURIComponent(text).toLowerCase();
  if (!q.trim()) return null;
  let best = null,
    bestScore = 0;
  for (const l of LOCATIONS) {
    const keys = [
      l.nameEn,
      l.nameKo,
      l.city,
      l.cityKo,
      ...(l.titles || []).flatMap((t) => [t.titleEn, t.titleKo]),
    ].filter(Boolean);
    let score = 0;
    for (const k of keys) {
      if (k.length > 2 && q.includes(k.toLowerCase())) score += k.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = l;
    }
  }
  return bestScore > 0 ? best : null;
}

function onResolve(e) {
  e.preventDefault();
  const input = document.getElementById("link-input");
  const out = document.getElementById("link-result");
  const v = input.value.trim();
  if (!v) {
    out.hidden = true;
    return;
  }
  const isUrl = /^https?:\/\//i.test(v);
  const m = matchContent(v);
  out.hidden = false;

  if (m) {
    if (typeof RR_MEM !== "undefined") RR_MEM.logEvent("match", { place: m.id });
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`;
    out.className = "link-result found";
    out.innerHTML = `
      <h3>📍 Found it — ${escapeHtml(m.nameEn)}</h3>
      <span class="ko">${escapeHtml(m.nameKo)} · ${escapeHtml(m.city)}, ${escapeHtml(m.region)}</span>
      <p><strong>How to get there:</strong> ${escapeHtml(m.gettingThere)}</p>
      <div class="actions">
        <a class="ghost" href="${mapUrl}" target="_blank" rel="noopener">Open in Google Maps</a>
      </div>`;
  } else {
    out.className = "link-result";
    out.innerHTML = isUrl
      ? `<p>In the live version, an AI watches the video and pinpoints the spot. For now I couldn't match this link — try typing <em>what the clip showed</em> (a drama name, a place, or e.g. "beautiful train station"), or browse the spots below.</p>`
      : `<p>I couldn't match that to our spots yet. Try a drama title (e.g. "Goblin"), a place ("Boseong tea field"), or browse the spots below.</p>`;
    document.getElementById("grid").scrollIntoView({ behavior: "smooth" });
  }
}

function filtered() {
  return LOCATIONS.filter((l) => {
    if (state.region !== "all" && l.region !== state.region) return false;
    if (state.category !== "all" && l.category !== state.category) return false;
    if (state.search) {
      const hay = [
        l.nameEn,
        l.nameKo,
        l.city,
        l.cityKo,
        ...(l.titles || []).flatMap((t) => [t.titleEn, t.titleKo]),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(state.search)) return false;
    }
    return true;
  });
}

function render() {
  const items = filtered();
  resultCount.textContent = `${items.length} location${items.length === 1 ? "" : "s"}`;
  empty.hidden = items.length !== 0;
  grid.innerHTML = items.map(cardHtml).join("");
  grid.querySelectorAll(".card").forEach((c) =>
    c.addEventListener("click", () => openModal(c.dataset.id))
  );
}

function cardHtml(l) {
  const titles = (l.titles || [])
    .map((t) => `<span class="tag">${escapeHtml(t.titleEn)}</span>`)
    .join("");
  return `
    <article class="card" data-id="${l.id}">
      <div class="card-top">
        <span class="badge">${l.category === "movie" ? "🎥 Movie" : "📺 Drama"}</span>
        <span class="badge">${escapeHtml(l.city)}</span>
      </div>
      <h3>${escapeHtml(l.nameEn)}</h3>
      <span class="ko">${escapeHtml(l.nameKo)}</span>
      <div class="titles">${titles}</div>
      <p class="desc">${escapeHtml(truncate(l.description, 110))}</p>
    </article>`;
}

let _locMap = null;

const EXP_ICON = { drama: "📺", movie: "🎥" };

function openModal(id) {
  const l = LOCATIONS.find((x) => x.id === id);
  if (!l) return;
  const titles = (l.titles || [])
    .map(
      (t) =>
        `<span class="tag">${escapeHtml(t.titleEn)}${t.year ? " (" + t.year + ")" : ""}</span>`
    )
    .join(" ");
  const nearby = (l.nearby || []).map((n) => `<li>${escapeHtml(n)}</li>`).join("");
  const extUrl = `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`;

  document.getElementById("modal-body").innerHTML = `
    <h2>${escapeHtml(l.nameEn)}</h2>
    <p class="ko">${escapeHtml(l.nameKo)} · ${escapeHtml(l.city)}, ${escapeHtml(l.region)}</p>

    <div class="modal-section">
      <h4>Featured in</h4>
      <p>${titles || "—"}</p>
    </div>

    <div class="modal-section">
      <h4>About</h4>
      <p>${escapeHtml(l.description)}</p>
    </div>

    <div class="modal-section">
      <h4>How to get there</h4>
      <p>${escapeHtml(l.gettingThere || "—")}</p>
    </div>

    ${nearby ? `<div class="modal-section"><h4>Nearby</h4><ul>${nearby}</ul></div>` : ""}

    <div class="modal-section">
      <h4>Location</h4>
      <div id="loc-map"></div>
      <a class="ext-map-link" href="${extUrl}" target="_blank" rel="noopener">Open in Google Maps ↗</a>
    </div>

    ${l.confidence && l.confidence !== "high" ? `<p class="conf">⚠ Filming-location data marked "${l.confidence}" confidence — please double-check before travel.</p>` : ""}
  `;

  document.getElementById("modal").hidden = false;

  if (_locMap) { _locMap.remove(); _locMap = null; }
  _locMap = L.map("loc-map").setView([l.lat, l.lng], 14);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(_locMap);
  const pin = L.divIcon({
    html: EXP_ICON[l.category] || "📍",
    className: "exp-pin",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
  L.marker([l.lat, l.lng], { icon: pin })
    .addTo(_locMap)
    .bindPopup(`<strong>${escapeHtml(l.nameEn)}</strong><br><span style="color:#666">${escapeHtml(l.nameKo)}</span>`)
    .openPopup();
}

function closeModal() {
  document.getElementById("modal").hidden = true;
  if (_locMap) { _locMap.remove(); _locMap = null; }
}

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
