// Supabase client (REST, no SDK needed). The backend half of the event spine.
// memory.js calls rrInsertEvent() on every logged event; live.js reads back the
// safe aggregates. The publishable/anon key is meant to be public (client-side);
// RLS lets anon INSERT events + call aggregate RPCs, but NOT read raw rows.
const RR_SUPABASE = {
  url: "https://nmzngmmaxcqrtdryubsd.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tem5nbW1heGNxcnRkcnl1YnNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzY2MzMsImV4cCI6MjA5MDgxMjYzM30.s-NtsP1HZP3lG-u-GCLgj3gJda3bvfIxKu0n6vk_hQg",
};

function rrHeaders(extra) {
  return Object.assign(
    { apikey: RR_SUPABASE.key, Authorization: "Bearer " + RR_SUPABASE.key, "Content-Type": "application/json" },
    extra || {}
  );
}

// Fire-and-forget insert of one traveler_event row. Never blocks/throws to the UI.
function rrInsertEvent(row) {
  try {
    return fetch(RR_SUPABASE.url + "/rest/v1/traveler_events", {
      method: "POST",
      headers: rrHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify(row),
      keepalive: true,
    }).catch(() => {});
  } catch (e) { return Promise.resolve(); }
}

async function rrRpc(fn, args) {
  const res = await fetch(RR_SUPABASE.url + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: rrHeaders(),
    body: JSON.stringify(args || {}),
  });
  return res.json();
}

const rrEventsCount = () => rrRpc("rr_events_count");
const rrEventsBreakdown = () => rrRpc("rr_events_breakdown");
const rrRecentFlow = (n) => rrRpc("rr_recent_flow", { limit_n: n || 10 });
