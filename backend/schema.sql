-- Human Experience Graph — event-collection schema (V18 backend keystone)
-- =====================================================================
-- This is the whole point. ONE table — traveler_events — turns V23 (transition),
-- V24 (flow) and V25 (evolution) from "illustrative" to REAL, because it captures
-- the longitudinal signal all three need: who, what identity, which place, when.
--
-- Status: DESIGN ARTIFACT. Not yet applied. Apply to Supabase only on confirmation.
-- Target: Supabase (Postgres). Front-end currently emits these as localStorage
-- events via memory.js; swap that storage layer to these tables to go live.

-- A traveler = one quiz-taker (anonymous device id is fine to start).
create table if not exists travelers (
  id           uuid primary key default gen_random_uuid(),
  device_key   text unique,                 -- anonymous device/browser key
  identity     text,                         -- current traveler identity (V15)
  created_at   timestamptz not null default now()
);

-- ★ KEYSTONE. Each row is one observed step in a traveler's behavior.
-- identity_before / identity_after on a visit row = the raw material for
-- Identity Evolution (V25); ordered rows per traveler = Flow/Transition (V23/V24).
create table if not exists traveler_events (
  id               bigint generated always as identity primary key,
  traveler_id      uuid references travelers(id),
  device_key       text,                     -- denormalized for dedup/sequencing
  session_id       text,                     -- group a visit-burst into one trip
  event_type       text not null,            -- 'quiz'|'evolve'|'visit'|'save'|'guide_open'|'match'
  identity_before  text,
  place            text,
  identity_after   text,
  payload          jsonb,                    -- ratings, source video, etc.
  created_at       timestamptz not null default now()
);
create index if not exists idx_events_device_time on traveler_events (device_key, created_at);
create index if not exists idx_events_session on traveler_events (session_id, created_at);
create index if not exists idx_events_place on traveler_events (place);

-- Hygiene tiers (pollution hits before scarcity):
--  TIER 1 — client (cheap, untrusted): memory.js drops rapid repeat visit/
--           guide_open (same place within 60s) = refresh spam / misclicks.
--  TIER 2 — server (authoritative): canonical dedup via (device_key, session_id),
--           burst collapse, bot/heuristic filtering, rate limits. A client can't be
--           trusted for bot detection — it belongs here.
--  TIER 3 — analysis: weight by event_type. visit = behavior ("actually went");
--           save/quiz = stated interest. Don't treat them equally.
-- device_key + session_id are what make TIER 2 + ordered-trip reconstruction possible.

-- Convenience tables (can also be derived from traveler_events).
create table if not exists traveler_saves (
  traveler_id  uuid references travelers(id),
  place        text not null,
  identity     text,
  created_at   timestamptz not null default now(),
  primary key (traveler_id, place)
);

create table if not exists traveler_ratings (
  traveler_id    uuid references travelers(id),
  place          text not null,
  follow_ease    int,   -- 1..5  "easy to follow the creator's trip"
  transport      int,   -- 1..5
  photo          int,   -- 1..5  "photo recreatability"
  satisfaction   int,   -- 1..5
  created_at     timestamptz not null default now(),
  primary key (traveler_id, place)
);

-- Once ~10k traveler_events accumulate:
--   V24 flow    = SELECT place, identity_after ... GROUP BY  (transition probs)
--   V25 evolve  = SELECT identity_before, identity_after ... GROUP BY
--   V23 edges   = ordered pairs per traveler_id over created_at
-- The illustrative JSON demos (trips_demo, identity_evolution_demo) get deleted.
