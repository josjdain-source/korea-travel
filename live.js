// Live readout of the real Supabase-backed event graph (safe aggregates only).
load();
document.getElementById("refresh").addEventListener("click", load);

async function load() {
  try {
    const [count, breakdown, flow] = await Promise.all([rrEventsCount(), rrEventsBreakdown(), rrRecentFlow(12)]);
    renderCount(count);
    renderBreakdown(Array.isArray(breakdown) ? breakdown : []);
    renderFlow(Array.isArray(flow) ? flow : []);
  } catch (e) {
    document.getElementById("count").textContent = "(could not reach Supabase)";
  }
}

function renderCount(n) {
  document.getElementById("count").textContent = (typeof n === "number" ? n : 0).toLocaleString();
}

function renderBreakdown(rows) {
  const total = rows.reduce((a, r) => a + Number(r.n), 0) || 1;
  document.getElementById("breakdown").innerHTML = rows.length
    ? rows.map((r) => {
        const pct = Math.round((Number(r.n) / total) * 100);
        return `<div class="dna-row"><span class="dna-label">${esc(r.event_type)}</span><span class="dna-bar"><span style="width:${pct}%"></span></span><span class="dna-pct">${r.n}</span></div>`;
      }).join("")
    : `<p class="conf">No events yet — go click around the site, then refresh.</p>`;
}

function renderFlow(rows) {
  document.getElementById("flow").innerHTML = rows.length
    ? rows.map((r) => `<span class="tag">${esc(r.from_place)} → ${esc(r.to_place)}</span>`).join(" ")
    : `<p class="conf">No visit→visit transitions yet — visit two places, then refresh.</p>`;
}

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
