// V12: Traveler DNA quiz. Action-based questions (NOT "favorite place") so the
// user's answers land in the SAME action vector space as Creator DNA / Place DNA.
// Then cosine() matches the traveler to creators and places. Engine = engine.js.

// Each option contributes action labels — these MUST match engine.js ACTION_RULES.
const QUESTIONS = [
  {
    q: "Arriving in a new city, the first thing you do is…",
    opts: [
      { label: "Find a cozy cafe", actions: ["Cafe hopping ☕"] },
      { label: "Head to the local market", actions: ["Browse the market 🛍️", "Eat local food 🍜"] },
      { label: "Wander the old alleys", actions: ["Explore traditional spots 🏯", "Sightseeing 🧭"] },
      { label: "Scout photo spots", actions: ["Photo spots 📸"] },
    ],
  },
  {
    q: "Your perfect morning is…",
    opts: [
      { label: "Sunrise by the sea", actions: ["Catch the sunrise 🌅", "Walk the coast 🌊"] },
      { label: "Slow coffee somewhere pretty", actions: ["Cafe hopping ☕"] },
      { label: "Street-food breakfast", actions: ["Eat local food 🍜", "Browse the market 🛍️"] },
      { label: "A quiet temple or palace", actions: ["Explore traditional spots 🏯"] },
    ],
  },
  {
    q: "Your camera roll is mostly…",
    opts: [
      { label: "Landscapes & nature", actions: ["Nature walk 🌿", "Photo spots 📸"] },
      { label: "Close-ups of food", actions: ["Eat local food 🍜"] },
      { label: "Hanok, hanbok, tradition", actions: ["Wear hanbok 👘", "Explore traditional spots 🏯"] },
      { label: "The sea & the coast", actions: ["Walk the coast 🌊"] },
    ],
  },
  {
    q: "A free afternoon — you go…",
    opts: [
      { label: "On a nature walk / hike", actions: ["Nature walk 🌿"] },
      { label: "Cafe hopping", actions: ["Cafe hopping ☕"] },
      { label: "Browsing a market", actions: ["Browse the market 🛍️"] },
      { label: "Hunting a drama filming spot", actions: ["Trace a drama scene 🎬"] },
    ],
  },
  {
    q: "You'd travel hours just for…",
    opts: [
      { label: "The best local meal", actions: ["Eat local food 🍜"] },
      { label: "An incredible view", actions: ["Catch the sunrise 🌅", "Nature walk 🌿"] },
      { label: "A historic site", actions: ["Explore traditional spots 🏯"] },
      { label: "A scene from your favorite show", actions: ["Trace a drama scene 🎬"] },
    ],
  },
  {
    q: "Evenings are for…",
    opts: [
      { label: "Night market & street food", actions: ["Browse the market 🛍️", "Eat local food 🍜"] },
      { label: "A quiet walk by the water", actions: ["Walk the coast 🌊"] },
      { label: "A festival or lights", actions: ["Festivals & events 🎉"] },
      { label: "Editing photos in a cafe", actions: ["Cafe hopping ☕", "Photo spots 📸"] },
    ],
  },
  {
    q: "Pick a trip vibe:",
    opts: [
      { label: "Adventure & discovery", actions: ["Sightseeing 🧭", "Festivals & events 🎉"] },
      { label: "Calm & healing", actions: ["Nature walk 🌿", "Walk the coast 🌊"] },
      { label: "All about the food", actions: ["Eat local food 🍜", "Browse the market 🛍️"] },
      { label: "Aesthetic & romantic", actions: ["Cafe hopping ☕", "Photo spots 📸"] },
    ],
  },
];

let DATA = { creators: [], visits: [] };
let answers = {}; // qIndex -> actions[]

init();

async function init() {
  try {
    DATA = await (await fetch("data/visits.json")).json();
  } catch (e) {
    document.getElementById("quiz").innerHTML = `<p class="empty">Could not load data.</p>`;
    return;
  }
  renderQuestions();
  document.getElementById("submit").addEventListener("click", showResult);
}

function renderQuestions() {
  document.getElementById("quiz").innerHTML = QUESTIONS.map(
    (q, i) => `
      <fieldset class="q">
        <legend>${i + 1}. ${esc(q.q)}</legend>
        <div class="q-opts">
          ${q.opts
            .map((o, j) => `<button type="button" class="chip" data-q="${i}" data-o="${j}">${esc(o.label)}</button>`)
            .join("")}
        </div>
      </fieldset>`
  ).join("");

  document.querySelectorAll(".q-opts .chip").forEach((btn) =>
    btn.addEventListener("click", () => {
      const qi = +btn.dataset.q;
      const group = btn.parentElement;
      group.querySelectorAll(".chip").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      answers[qi] = QUESTIONS[qi].opts[+btn.dataset.o].actions;
      // Answer as many as you like — even one is enough to compute a DNA.
      const n = Object.keys(answers).length;
      const submitBtn = document.getElementById("submit");
      submitBtn.disabled = n < 1;
      submitBtn.textContent = n < QUESTIONS.length ? `See my Traveler DNA (${n}/${QUESTIONS.length}) →` : "See my Traveler DNA →";
    })
  );
}

function showResult() {
  // Traveler action vector — chosen options already carry canonical action
  // labels, so we count them directly into the same space as creators/places.
  const traveler = {};
  for (const a of Object.values(answers).flat()) traveler[a] = (traveler[a] || 0) + 1;

  const emo = dnaPercentObj(emotionProfile(traveler));
  const topActions = dnaPercentObj(traveler).slice(0, 5);

  // Match to creators (cosine in action space).
  const creatorMatches = (DATA.creators || [])
    .map((c) => {
      const vs = (DATA.visits || []).filter((v) => v.creatorId === c.id);
      const vec = actionVector(vs.map((v) => `${v.spot || ""} ${v.reason || ""}`));
      return { c, sim: cosine(traveler, vec) };
    })
    .filter((x) => x.sim > 0)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 4);

  // Match to places (same vector space).
  const placeGroups = {};
  for (const v of DATA.visits || []) {
    const k = v.place || v.city;
    (placeGroups[k] = placeGroups[k] || []).push(`${v.spot || ""} ${v.reason || ""}`);
  }
  const placeMatches = Object.entries(placeGroups)
    .map(([label, texts]) => ({ label, sim: cosine(traveler, actionVector(texts)) }))
    .filter((x) => x.sim > 0)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 5);

  const ident = identityOf(traveler)[0]; // V15: the headline identity
  RR_MEM.setTraveler(ident.name); // V16.5: remember the traveler (this device)

  const r = document.getElementById("result");
  r.hidden = false;
  r.innerHTML = `
    <div class="identity-card">
      <p class="identity-pre">You are…</p>
      <h2 class="identity-name">${esc(ident.name)}</h2>
      <p class="identity-blurb">${esc(ident.blurb)}</p>
      <a class="map-btn" href="tribe.html?id=${encodeURIComponent(ident.name)}" style="margin-top:14px;">👥 See your tribe &amp; where they go →</a>
    </div>
    <div class="place-sec">
      <h3>How you travel</h3>
      <div class="dna">${bars(topActions)}</div>
    </div>
    ${emo.length ? `<div class="place-sec"><h3>What you're really after</h3><div class="dna">${bars(emo)}</div></div>` : ""}
    <div class="place-sec">
      <h3>Creators who are the same kind of traveler <span class="conf">— examples of your identity</span></h3>
      <div class="match-list">${creatorMatches
        .map((m) => `<a class="match" href="${m.c.url}" target="_blank" rel="noopener"><strong>${esc(m.c.name)}</strong><span>${Math.round(m.sim * 100)}% match</span></a>`)
        .join("")}</div>
    </div>
    <div class="place-sec">
      <h3>Places for you</h3>
      <div class="titles">${placeMatches
        .map((m) => `<a class="tag" href="place.html?place=${encodeURIComponent(m.label)}&mode=place">${esc(m.label)} <em>${Math.round(m.sim * 100)}%</em></a>`)
        .join(" ")}</div>
    </div>
    <p class="conf">Matched in the same action vector space as Creator DNA & Place DNA. Seed dataset of ${(DATA.creators || []).length} creators — directional.</p>
    <p class="conf">📡 You've contributed <strong>${RR_MEM.events().length}</strong> event(s) to the behavior graph (this device). At scale, these <code>traveler_events</code> make Flow (V24) & Evolution (V25) real — see <code>backend/schema.sql</code>.</p>
  `;
  r.scrollIntoView({ behavior: "smooth" });
}

function dnaPercentObj(obj) {
  const total = Object.values(obj).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(obj).map(([k, n]) => ({ theme: k, pct: Math.round((n / total) * 100) })).sort((a, b) => b.pct - a.pct);
}
function bars(rows) {
  return rows
    .map((d) => `<div class="dna-row"><span class="dna-label">${esc(d.theme)}</span><span class="dna-bar"><span style="width:${d.pct}%"></span></span><span class="dna-pct">${d.pct}%</span></div>`)
    .join("");
}
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
