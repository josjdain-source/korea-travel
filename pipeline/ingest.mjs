// "Global Interest Radar" — ingestion skeleton.
//
// The thesis the user reached: we're not a tourism site, we're a RADAR that
// tracks where the world's creators actually go in Korea. This script is that
// radar's spine. Run offline: `node pipeline/ingest.mjs`
//
// It is deliberately thin. There are exactly THREE pluggable points, and they
// map to the three things that are actually hard (none of them is crawling):
//
//   1) TRACKED_CREATORS  — WHICH channels to follow. This is curation = the moat.
//   2) fetchRecentVideos — the data source (YouTube Data API / oEmbed). STUB here.
//   3) extractPlaces     — turn a video into place mentions (title → captions →
//                          ultimately vision on the frames). STUB here.
//
// The one genuinely-solved hard part lives below in normalizePlace(): mapping
// messy free-text mentions to ONE canonical place so creator counts aggregate.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const GAZETTEER = JSON.parse(readFileSync(join(HERE, "place_aliases.json"), "utf8")).places;

// (1) The curated channel list — start with ~100 hand-picked creators, no API needed.
const TRACKED_CREATORS = [
  { id: "mark-wiens", name: "Mark Wiens", country: "US" },
  { id: "next-stop-korea", name: "Next Stop: Korea", country: "DE" },
];

// (2) STUB: in production, call the YouTube Data API for this channel's recent
// uploads (title, description, viewCount) — that part is genuinely easy & legal.
async function fetchRecentVideos(creator) {
  const SAMPLE = {
    "mark-wiens": [
      { title: "Korean SEAFOOD Heaven in Tongyeong 🇰🇷", url: "https://youtu.be/EXAMPLE1", views: 1500000, captions: "we drove down to Tongyeong on the south coast for the seafood market" },
    ],
    "next-stop-korea": [
      { title: "A perfect day trip from Seoul 🇰🇷", url: "https://youtu.be/EXAMPLE2", views: 8000, captions: "today we are exploring the bamboo forest at Juknokwon in Damyang" },
    ],
  };
  return SAMPLE[creator.id] || [];
}

// (3) STUB: in production this is an LLM over (title + description + captions),
// and eventually a vision model over the frames for clips that only say "Korea 🇰🇷".
// Here we just scan the text for any known alias to prove the flow end-to-end.
function extractPlaces(video) {
  const text = `${video.title} ${video.captions || ""}`.toLowerCase();
  const hits = [];
  for (const p of GAZETTEER) {
    if (p.aliases.some((a) => text.includes(a))) {
      hits.push({ rawMention: p.canonical, reason: guessReason(text) });
    }
  }
  return hits;
}

function guessReason(text) {
  if (/seafood|food|eat|market|bibimbap/.test(text)) return "food";
  if (/temple|hanok|palace|tradition/.test(text)) return "culture";
  if (/beach|bamboo|forest|sunrise|nature|coast/.test(text)) return "nature";
  return "travel";
}

// SOLVED hard part: messy mention → one canonical place (+ city/region).
function normalizePlace(mention) {
  const m = mention.toLowerCase();
  for (const p of GAZETTEER) {
    if (p.canonical.toLowerCase() === m || p.aliases.some((a) => m.includes(a))) {
      return { place: p.canonical, city: p.city, region: p.region };
    }
  }
  return null; // unknown → queue for human review, never guessed into the data
}

async function run() {
  const out = [];
  for (const creator of TRACKED_CREATORS) {
    const videos = await fetchRecentVideos(creator);
    for (const v of videos) {
      for (const hit of extractPlaces(v)) {
        const norm = normalizePlace(hit.rawMention);
        if (!norm) continue;
        out.push({
          creatorId: creator.id,
          ...norm,
          spot: v.title,
          views: v.views,
          reason: hit.reason,
          videoUrl: v.url,
          confidence: "low", // auto-ingested → low until a human verifies
          sources: [v.url],
        });
      }
    }
  }
  // Non-destructive: write a candidate file for review, don't touch curated visits.json.
  const dest = join(HERE, "ingested.candidates.json");
  writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(`Radar pass: ${TRACKED_CREATORS.length} creators → ${out.length} candidate visit(s).`);
  for (const r of out) console.log(`  • ${r.creatorId} → ${r.place} (${r.city}) — ${r.reason} [${(r.views / 1000).toFixed(0)}K]`);
  console.log(`\nWrote candidates to ${dest}. Review, then merge verified rows into data/visits.json.`);
}

run();
