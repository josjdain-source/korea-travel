"""
Pipeline Orchestrator
Usage:
  python pipeline/run.py                      # daily monitoring (MAX_PER_CREATOR)
  python pipeline/run.py --deep               # bootstrap: scan 20 videos per creator
  python pipeline/run.py --creator mark-wiens # single creator
  python pipeline/run.py --url https://...    # single video URL
"""
import json
import os
import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import (
    ANTHROPIC_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY,
    VISITS_FILE, PROCESSED_FILE, CREATORS, MAX_PER_CREATOR,
)
from fetch import get_channel_videos, fetch_video_info
from analyze import analyze_video
from geocode import geocode_moments
from writer import write_visit
from score import korea_score, SCORE_THRESHOLD, caption_confirms_korea

STATS_FILE = str(Path(__file__).parent / "creator_stats.json")
DEEP_SCAN_SIZE = 20


# ── State helpers ──────────────────────────────────────────────────────────

def load_processed():
    if os.path.exists(PROCESSED_FILE):
        return set(json.load(open(PROCESSED_FILE)))
    return set()

def save_processed(done):
    json.dump(list(done), open(PROCESSED_FILE, "w"))

def load_stats():
    if os.path.exists(STATS_FILE):
        return json.load(open(STATS_FILE, encoding="utf-8"))
    return {}

def save_stats(stats):
    json.dump(stats, open(STATS_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)


# ── Single-video processing ────────────────────────────────────────────────

def process_video(creator_id, video_url, processed, ai_key, stats, creator_meta=None, video_meta=None):
    """Full pipeline for one video. Returns 'added' | 'skip' | 'error' | 'dup'."""
    vid_id = video_url.split("v=")[-1].split("&")[0]

    s = stats.setdefault(creator_id, {"country": (creator_meta or {}).get("country", "?"),
                                       "scanned": 0, "korea": 0, "skip": 0, "error": 0})

    if vid_id in processed:
        print("    ↩ already processed")
        return "dup"

    s["scanned"] += 1

    # 1. Pre-score from flat metadata (free — no extra network call)
    meta_score = korea_score(video_meta or {})
    if meta_score < SCORE_THRESHOLD:
        print(f"    ↩ score {meta_score} < {SCORE_THRESHOLD} — skipped")
        processed.add(vid_id)
        s["skip"] += 1
        return "skip"

    print(f"    ✦ score {meta_score} — fetching captions…")

    # 2. Fetch captions (only for scored candidates)
    info = fetch_video_info(video_url)

    if not info.get("captions") and not info.get("description"):
        print("    ⚠ no content — skipping")
        processed.add(vid_id)
        s["skip"] += 1
        return "skip"

    # 3. Caption gate — must contain hard Korea keyword before LLM call
    if not caption_confirms_korea(info.get("captions", "")):
        print("    ↩ caption has no Korea keyword — LLM blocked")
        processed.add(vid_id)
        s["skip"] += 1
        return "skip"

    # 4. Analyze
    print("    🤖 analyzing…")
    try:
        result = analyze_video(info, ai_key)
    except Exception as e:
        print(f"    ❌ error: {e}")
        processed.add(vid_id)
        s["error"] += 1
        return "error"

    if result.get("skip"):
        print(f"    ⏭ {result.get('reason', 'not Korea')}")
        processed.add(vid_id)
        s["skip"] += 1
        return "skip"

    # 3. Geocode
    print("    🗺 geocoding…")
    result["moments"] = geocode_moments(result.get("moments") or [], result.get("city", ""))

    # 4. Assemble visit record
    visit = {
        "creatorId":  creator_id,
        "place":      result.get("place", ""),
        "city":       result.get("city", ""),
        "region":     result.get("region", ""),
        "spot":       result.get("spot", info["title"])[:80],
        "views":      info.get("view_count", 0),
        "reason":     result.get("reason", ""),
        "videoUrl":   video_url,
        "uploaded":   info.get("upload_date", ""),
        "confidence": "ai-generated",
        "sources":    [video_url],
        "moments":    result.get("moments") or [],
    }

    # 5. Write
    written = write_visit(visit, VISITS_FILE, SUPABASE_URL, SUPABASE_SERVICE_KEY)
    processed.add(vid_id)

    if written:
        n = len(visit["moments"])
        s["korea"] += 1
        print(f"    ✅ {visit['place']} — {n} moments")
        return "added"
    else:
        print("    ↩ already in visits.json")
        return "dup"


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--creator", help="process only this creator id")
    parser.add_argument("--url",     help="process a single video URL directly")
    parser.add_argument("--deep",    action="store_true",
                        help=f"bootstrap scan: {DEEP_SCAN_SIZE} videos per creator")
    args = parser.parse_args()

    AI_KEY = GROQ_API_KEY or GEMINI_API_KEY or ANTHROPIC_API_KEY
    if not AI_KEY:
        print("❌ GROQ_API_KEY not set. Edit pipeline/.env first.")
        sys.exit(1)

    processed = load_processed()
    stats = load_stats()
    added = 0

    # ── Single URL mode ────────────────────────────────────────────────────
    if args.url:
        creator_id = args.creator or "unknown"
        print(f"\n🎬 {args.url}")
        r = process_video(creator_id, args.url, processed, AI_KEY, stats)
        if r == "added":
            added += 1
        save_processed(processed)
        save_stats(stats)
        print(f"\nDone. {added} new visit(s) added.")
        return

    # ── Channel sweep mode ─────────────────────────────────────────────────
    scan_size = DEEP_SCAN_SIZE if args.deep else MAX_PER_CREATOR
    fetch_size = scan_size + 3

    creators = CREATORS
    if args.creator:
        creators = [c for c in CREATORS if c["id"] == args.creator]
        if not creators:
            print(f"❌ Unknown creator: {args.creator}")
            sys.exit(1)

    mode = "DEEP SCAN" if args.deep else "daily"
    print(f"\n{'═'*50}")
    print(f"  {mode} — {len(creators)} creators × up to {scan_size} videos")
    print(f"{'═'*50}")

    for creator in creators:
        print(f"\n📺  [{creator.get('country','?')}] {creator['id']}")
        videos = get_channel_videos(creator["url"], max_videos=fetch_size)
        new_videos = [v for v in videos if v["id"] not in processed]

        if not new_videos:
            print("   no new videos")
            continue

        for v in new_videos[:scan_size]:
            print(f"   🎬 {v['title'][:65]}")
            r = process_video(creator["id"], v["url"], processed, AI_KEY, stats, creator, video_meta=v)
            if r == "added":
                added += 1

        save_processed(processed)
        save_stats(stats)

    print(f"\n{'─'*50}")
    print(f"Done. {added} new Korea visit(s) added.")
    if added:
        print("Run  python pipeline/report.py  to see creator density table.")


if __name__ == "__main__":
    main()
