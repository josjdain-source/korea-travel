// Tribe Memory + event-collection SPINE (V16.5 → V18 bridge).
//
// Front-end half of backend/schema.sql. Every meaningful action is logged as a
// traveler_event in the SAME shape the table stores — now with the quality fields
// dedup & transition analysis need from day one: device_key, session_id,
// event_type, place, identity_before/after, created_at. Today writes to
// localStorage; swap the storage calls for Supabase inserts to go live.
//
// Hygiene matters as much as volume: the first real problem is pollution (refresh
// spam, bots, misclicks), not scarcity — so we de-dup obvious noise at the source.

const RR_DEDUP_TYPES = new Set(["visit", "guide_open"]); // refresh/repeat-prone

const RR_MEM = {
  // ── stable anonymous device id + per-session id (for dedup & sequencing) ──
  deviceKey() {
    let k = null;
    try { k = localStorage.getItem("rr_device"); } catch (e) {}
    if (!k) {
      k = "d_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem("rr_device", k); } catch (e) {}
    }
    return k;
  },
  sessionId() {
    let s = null;
    try { s = sessionStorage.getItem("rr_session"); } catch (e) {}
    if (!s) {
      s = "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      try { sessionStorage.setItem("rr_session", s); } catch (e) {}
    }
    return s;
  },

  // ── traveler (current identity) ────────────────────────────────────────
  traveler() {
    try { return JSON.parse(localStorage.getItem("rr_traveler") || "null"); }
    catch (e) { return null; }
  },
  setTraveler(identity) {
    const prev = RR_MEM.traveler();
    if (prev && prev.identity && prev.identity !== identity) {
      RR_MEM.logEvent("evolve", { identity_before: prev.identity, identity_after: identity });
    }
    RR_MEM.logEvent("quiz", { identity_after: identity });
    localStorage.setItem("rr_traveler", JSON.stringify({ identity }));
  },

  // ── saves ──────────────────────────────────────────────────────────────
  saves() {
    try { return JSON.parse(localStorage.getItem("rr_saves") || "[]"); }
    catch (e) { return []; }
  },
  addSave(s) {
    const all = RR_MEM.saves();
    if (!all.find((x) => x.place === s.place)) {
      all.push(s);
      localStorage.setItem("rr_saves", JSON.stringify(all));
      RR_MEM.logEvent("save", { place: s.place, identity_after: s.identity || null });
    }
    return all;
  },
  savesFor(identity) {
    return RR_MEM.saves().filter((s) => s.identity === identity);
  },

  // ── event log (= traveler_events rows, awaiting a backend) ──────────────
  events() {
    try { return JSON.parse(localStorage.getItem("rr_events") || "[]"); }
    catch (e) { return []; }
  },
  logEvent(type, payload = {}) {
    const all = RR_MEM.events();
    const session_id = RR_MEM.sessionId();
    // Source-side hygiene: drop RAPID repeats (refresh spam / misclick) — same
    // view+place within a short window. A genuine later re-visit still counts.
    const REPEAT_WINDOW_MS = 60_000;
    if (RR_DEDUP_TYPES.has(type)) {
      const now = Date.now();
      const place = payload.place ?? null;
      const recent = all.some((e) => e.event_type === type && e.place === place && now - new Date(e.created_at).getTime() < REPEAT_WINDOW_MS);
      if (recent) return all;
    }
    const row = {
      event_type: type,
      device_key: RR_MEM.deviceKey(),
      session_id,
      place: payload.place ?? null,
      identity_before: payload.identity_before ?? null,
      identity_after: payload.identity_after ?? null,
      created_at: new Date().toISOString(),
    };
    all.push(row);
    localStorage.setItem("rr_events", JSON.stringify(all)); // offline mirror
    if (typeof rrInsertEvent === "function") rrInsertEvent(row); // → Supabase (live)
    return all;
  },
};
