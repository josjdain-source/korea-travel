// engine.js — single source of truth for the vocabularies + scoring used across
// ranking.js and place.js. Loaded as a plain <script> BEFORE those files, so its
// functions/constants are globals. Keep ALL theme/action logic here (don't dup).

// V3: broad themes (the "experience" axis on the main page).
const THEME_RULES = [
  [/food|seafood|bibimbap|makgeolli|beef|eat|market/, "Food"],
  [/histor|tomb|heritage/, "History"],
  [/tradition|culture|palace|temple|hanok|folk|retro/, "Culture"],
  [/nature|beach|coast|tea|bamboo|sunrise|scenery|forest|\bsea\b/, "Nature"],
  [/cafe|coffee/, "Cafe"],
  [/drama|film/, "K-Drama"],
  [/local life|rural|living|city/, "Local Life"],
];

// V4: granular ACTION tags — what a creator actually DID. The whole V6–V10 ladder
// (experience engine, creator routes, AI scoring, reverse match) is built on these.
// Derived from the creator's own video title/description text — inference, not
// fabrication. Proper tagging will later come from video analysis.
const ACTION_RULES = [
  [/hanbok/, "Wear hanbok 👘"],
  [/bibimbap|seafood|\bfood\b|\beat\b|restaurant|street food|makgeolli|beef|cuisine|culinary|tea house/, "Eat local food 🍜"],
  [/sunrise|sunset/, "Catch the sunrise 🌅"],
  [/beach|coast|seaside|\bsea\b|ocean/, "Walk the coast 🌊"],
  [/cafe|coffee/, "Cafe hopping ☕"],
  [/hanok|old town|folk|palace|traditional|temple|heritage|histor|tomb/, "Explore traditional spots 🏯"],
  [/bamboo|forest|garden|tea field|tea plantation|\bnature\b|wetland|scenery/, "Nature walk 🌿"],
  [/drama|film|\bscene\b/, "Trace a drama scene 🎬"],
  [/photo|drone|scenic/, "Photo spots 📸"],
  [/festival|expo|\bevent\b/, "Festivals & events 🎉"],
  [/market|night market/, "Browse the market 🛍️"],
];

function matchRules(rules, text, fallback) {
  const out = new Set();
  for (const [re, label] of rules) if (re.test(text)) out.add(label);
  if (!out.size && fallback) out.add(fallback);
  return [...out];
}

// reason string → themes (splits compound reasons like "history & food").
function themesOf(reason) {
  const out = new Set();
  for (const part of String(reason).split(/&|,|\//)) {
    const p = part.trim().toLowerCase();
    if (!p) continue;
    for (const t of matchRules(THEME_RULES, p)) out.add(t);
  }
  if (!out.size) out.add("Travel");
  return [...out];
}

// free text (spot + reason) → action tags.
function actionsOf(text) {
  return matchRules(ACTION_RULES, String(text).toLowerCase(), "Sightseeing 🧭");
}

// {reasonString: count} → {theme: weight}.  The place's DNA profile.
function themeProfile(reasonsMap) {
  const prof = {};
  for (const [reason, count] of Object.entries(reasonsMap || {})) {
    for (const theme of themesOf(reason)) prof[theme] = (prof[theme] || 0) + count;
  }
  return prof;
}

function dnaPercent(prof) {
  const total = Object.values(prof).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(prof)
    .map(([theme, n]) => ({ theme, pct: Math.round((n / total) * 100) }))
    .sort((a, b) => b.pct - a.pct);
}

// cosine similarity between two profiles (V5 recommendation).
function cosine(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, na = 0, nb = 0;
  for (const k of keys) {
    const x = a[k] || 0, y = b[k] || 0;
    dot += x * y; na += x * x; nb += y * y;
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

// V13: ACTION VECTOR — the shared vector space. Creator DNA, Place DNA and the
// quiz's Traveler DNA are ALL action-count vectors over the same ACTION_RULES
// labels, so any two can be compared with cosine() directly.
function actionVector(texts) {
  const vec = {};
  for (const t of texts) for (const a of actionsOf(t)) vec[a] = (vec[a] || 0) + 1;
  return vec;
}

// V14: EMOTION DNA — actions are still surface; underneath sits the feeling.
// Map each action to the emotions it usually expresses (inferred, not declared).
const EMOTION_OF = {
  "Wear hanbok 👘": ["Nostalgia", "Romance"],
  "Eat local food 🍜": ["Discovery"],
  "Catch the sunrise 🌅": ["Healing", "Achievement"],
  "Walk the coast 🌊": ["Healing"],
  "Cafe hopping ☕": ["Aesthetic"],
  "Explore traditional spots 🏯": ["Nostalgia", "Discovery"],
  "Nature walk 🌿": ["Healing"],
  "Trace a drama scene 🎬": ["Romance", "Nostalgia"],
  "Photo spots 📸": ["Aesthetic"],
  "Festivals & events 🎉": ["Adventure"],
  "Browse the market 🛍️": ["Discovery", "Adventure"],
  "Sightseeing 🧭": ["Adventure", "Discovery"],
};
function emotionProfile(actionVec) {
  const out = {};
  for (const [action, w] of Object.entries(actionVec)) {
    for (const emo of EMOTION_OF[action] || []) out[emo] = (out[emo] || 0) + w;
  }
  return out;
}

// V15: named TRAVELER IDENTITIES — the headline result. Each is a prototype in
// the SAME action vector space, so a traveler/creator is matched to one by cosine.
// People remember "I'm a Hidden Path Explorer" far better than "92% Drew Binsky";
// creators become *examples* of an identity, so the engine survives creator churn
// and ports to any country (just add visits — identities stay).
const IDENTITIES = [
  { name: "Street Flavor Hunter 🍜", blurb: "You travel on your stomach — markets, street stalls, the dish locals actually eat.", vec: { "Eat local food 🍜": 3, "Browse the market 🛍️": 2 } },
  { name: "Hidden Path Explorer 🧭", blurb: "Off the beaten track. You'd rather wander an unknown alley than queue for a landmark.", vec: { "Sightseeing 🧭": 3, "Nature walk 🌿": 1, "Explore traditional spots 🏯": 1 } },
  { name: "Quiet Horizon Wanderer 🌅", blurb: "Sea, sunrise, slow air. You travel to exhale.", vec: { "Catch the sunrise 🌅": 2, "Walk the coast 🌊": 2, "Nature walk 🌿": 2 } },
  { name: "Aesthetic Cafe Soul ☕", blurb: "A beautiful frame and a good coffee — the vibe is the destination.", vec: { "Cafe hopping ☕": 3, "Photo spots 📸": 2 } },
  { name: "Heritage Romantic 🏯", blurb: "Hanbok, palaces and scenes from a drama — you chase the romance of the past.", vec: { "Explore traditional spots 🏯": 2, "Wear hanbok 👘": 2, "Trace a drama scene 🎬": 1 } },
  { name: "Festival Chaser 🎉", blurb: "Lights, crowds, energy — you go where things are happening.", vec: { "Festivals & events 🎉": 3, "Browse the market 🛍️": 1 } },
];

function identityOf(actionVec) {
  return IDENTITIES.map((id) => ({ ...id, sim: cosine(actionVec, id.vec) })).sort((a, b) => b.sim - a.sim);
}

// V11: themes roll up into durable traveler ARCHETYPES. Creators change and
// platforms die, but "how you travel" doesn't — so archetypes outlast creators
// and become the matching axis ("you are 92% the same traveler as Drew Binsky").
const THEME_TO_ARCHETYPE = {
  Food: "Food Hunter 🍜",
  Nature: "Healing Wanderer 🌿",
  Cafe: "Aesthetic Traveler 📸",
  "K-Drama": "K-Drama Dreamer 🎬",
  Culture: "Culture Seeker 🏯",
  History: "Culture Seeker 🏯",
  "Local Life": "Explorer 🧭",
  Travel: "Explorer 🧭",
};

function archetypeProfile(themeProf) {
  const out = {};
  for (const [theme, w] of Object.entries(themeProf)) {
    const a = THEME_TO_ARCHETYPE[theme] || "Explorer 🧭";
    out[a] = (out[a] || 0) + w;
  }
  return out;
}

// V16.8: EMERGING TRIBES — bottom-up. IDENTITIES above are top-down (we named
// them). A real network DISCOVERS tribes by clustering traveler action vectors:
// nobody declared "Heritage Cafe Wanderers" — it falls out of the data. This is
// the asset a tourism board can't build (they see places; we see behavior).
const ACTION_NOUN = {
  "Eat local food 🍜": "Flavor",
  "Browse the market 🛍️": "Market",
  "Catch the sunrise 🌅": "Sunrise",
  "Walk the coast 🌊": "Coast",
  "Cafe hopping ☕": "Cafe",
  "Explore traditional spots 🏯": "Heritage",
  "Nature walk 🌿": "Nature",
  "Trace a drama scene 🎬": "Drama",
  "Photo spots 📸": "Frame",
  "Festivals & events 🎉": "Festival",
  "Wear hanbok 👘": "Hanbok",
  "Sightseeing 🧭": "Explorer",
};

function avgVec(vecs) {
  const out = {};
  for (const v of vecs) for (const [k, n] of Object.entries(v)) out[k] = (out[k] || 0) + n;
  const c = vecs.length || 1;
  for (const k in out) out[k] /= c;
  return out;
}

function tribeName(centroid) {
  const tops = [...new Set(Object.entries(centroid).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => ACTION_NOUN[k] || "Open-road"))];
  const suffix = tops.includes("Explorer") ? "s" : " Wanderers";
  return tops.join(" ") + suffix;
}

// Greedy single-pass clustering of entities ({label, vec}) by cosine similarity.
// Tiny + dependency-free; good enough to demonstrate emergence on seed data.
function discoverTribes(entities, threshold = 0.45) {
  const clusters = [];
  for (const e of entities) {
    let best = null, bestSim = threshold;
    for (const cl of clusters) {
      const s = cosine(e.vec, cl.centroid);
      if (s > bestSim) { bestSim = s; best = cl; }
    }
    if (best) { best.members.push(e); best.centroid = avgVec(best.members.map((m) => m.vec)); }
    else clusters.push({ members: [e], centroid: { ...e.vec } });
  }
  return clusters
    .filter((c) => c.members.length >= 2)
    .map((c) => ({
      name: tribeName(c.centroid),
      size: c.members.length,
      members: c.members,
      topActions: Object.entries(c.centroid).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k),
    }))
    .sort((a, b) => b.size - a.size);
}

// V21: explainability. The dimensions two vectors actually share = WHY they match.
// Lets a user trace "why was 화롄 recommended?" back through the graph — turning a
// recommender into a Behavior Map.
function sharedDimensions(a, b) {
  return Object.keys(a)
    .filter((k) => b[k])
    .map((k) => ({ key: k, weight: a[k] * b[k] }))
    .sort((x, y) => y.weight - x.weight);
}

// V24: FLOW. From "connected" (V23) to a probabilistic state machine — given
// ordered trips, P(next place | current place). This turns the graph into a
// behavior SIMULATOR ("after 강릉, where does this traveler flow?"). Needs many
// ordered trips at volume (backend); demo runs on clearly-illustrative trips.
// Interest vs behavior: a 'visit' (actually went) means far more than a 'save'
// (said they'd like to). INITIAL, UNTUNED weights — real values come from the
// data, not from here. Encoded so the distinction lives in the architecture.
const EVENT_WEIGHTS = {
  visit: 1.0,
  guide_open: 0.5,
  save: 0.3,
  match: 0.2,
  quiz: 0.1,
};

function flowMatrix(trips) {
  const counts = {}; // from -> { to: n }
  for (const seq of trips) {
    for (let i = 0; i < seq.length - 1; i++) {
      const from = seq[i], to = seq[i + 1];
      (counts[from] = counts[from] || {});
      counts[from][to] = (counts[from][to] || 0) + 1;
    }
  }
  const matrix = {};
  for (const [from, tos] of Object.entries(counts)) {
    const total = Object.values(tos).reduce((a, b) => a + b, 0) || 1;
    matrix[from] = Object.entries(tos)
      .map(([to, n]) => ({ to, prob: n / total, n }))
      .sort((a, b) => b.prob - a.prob);
  }
  return matrix;
}

// Real YouTube thumbnail from a real video URL (img.youtube.com is YT's public CDN).
// Returns null for channel URLs / non-YouTube — caller falls back gracefully.
function ytId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtu\.be\/|[?&]v=)([\w-]{6,})/);
  return m ? m[1] : null;
}
function ytThumb(url) {
  const id = ytId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
