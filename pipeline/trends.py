"""
Fetch Google Trends 90-day interest for Korea travel destinations.
Saves data/trends.json — run this weekly to keep badges fresh.

Usage: python pipeline/trends.py
"""
import json, time, os
from datetime import datetime

try:
    from pytrends.request import TrendReq
except ImportError:
    raise SystemExit("pip install pytrends")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
VISITS_PATH = os.path.join(ROOT, "data", "visits.json")
OUT_PATH = os.path.join(ROOT, "data", "trends.json")

REFERENCE = "Seoul Korea"   # anchor keyword present in every request for normalization
DELAY = 6                   # seconds between API calls — avoids 429
RISING_THRESHOLD = 20       # delta % to show 🔥 Rising badge
UP_THRESHOLD = 8            # delta % to show ↑ Trending badge

# Skip places that are obviously not Korean travel destinations
_SKIP = {
    "England", "New York City", "New York", "New Malden", "The Hague",
    "Eastbourne", "Korea University", "Korean college", "Korean restaurant",
    "Mountain Gym", "O2 Resort", "K-Arts", "Namyeong",
    "Yongsan Garrison", "포차",
}

# Aliases: our internal name → better Google Trends search term
_ALIAS = {
    "Jeju Island": "Jeju Island Korea",
    "Jeonju Hanok Village": "Jeonju Hanok Village Korea",
    "Gwangjang Market": "Gwangjang Market Seoul",
    "Gamcheon Culture Village": "Gamcheon Culture Village Busan",
    "Myeongdong": "Myeongdong Seoul",
    "Hongdae": "Hongdae Seoul",
    "Namsan": "Namsan Seoul",
    "Bukhansan": "Bukhansan Seoul",
    "Mangwon Market": "Mangwon Market Seoul",
    "Noryangjin Fish Market": "Noryangjin Fish Market Seoul",
    "Seoul City Wall": "Seoul City Wall Korea",
    "Korea": "Korea travel",
    "South Korea": "South Korea travel",
}


def get_targets():
    data = json.load(open(VISITS_PATH, encoding="utf-8"))
    seen = set()
    targets = []
    for v in data.get("visits", []):
        for key in (v.get("place"), v.get("city")):
            if key and key not in seen and key not in _SKIP:
                # skip overly long / compound strings
                if "/" in key or "," in key or len(key) > 40:
                    continue
                seen.add(key)
                targets.append(key)
    return sorted(targets)


def fetch_trend(pytrends, place):
    """Return (score, delta) normalized against REFERENCE, or (0,0) on failure."""
    search_term = _ALIAS.get(place, place)
    kw_list = [search_term, REFERENCE]
    try:
        pytrends.build_payload(kw_list, timeframe="today 3-m", geo="")
        df = pytrends.interest_over_time()
        if df.empty or search_term not in df.columns:
            return 0, 0
        ref_vals = df[REFERENCE].tolist()
        kw_vals  = df[search_term].tolist()
        ref_mean = sum(ref_vals) / max(len(ref_vals), 1)
        if ref_mean < 1:
            return 0, 0
        normalized = [k / ref_mean * 100 for k in kw_vals]
        n = len(normalized)
        if n < 5:
            return 0, 0
        recent = sum(normalized[-4:]) / 4
        prior  = sum(normalized[:-4]) / max(n - 4, 1)
        delta  = round(((recent / max(prior, 0.1)) - 1) * 100)
        score  = round(recent)
        return score, delta
    except Exception as e:
        print(f"  ! {e}")
        return 0, 0


def classify(delta):
    if delta >= RISING_THRESHOLD:  return "rising"
    if delta >= UP_THRESHOLD:      return "up"
    if delta >= -10:               return "stable"
    return "down"


def main():
    import sys
    retry_only = "--retry" in sys.argv  # only process 429 failures from previous run

    pytrends = TrendReq(hl="en-US", tz=540, timeout=(15, 60))
    targets = get_targets()

    existing = {}
    if retry_only and os.path.exists(OUT_PATH):
        existing = json.load(open(OUT_PATH, encoding="utf-8")).get("places", {})
        # retry only score=0 AND delta=0 (marks a 429 failure, not genuine no-data)
        targets = [p for p in targets if existing.get(p, {}).get("score") == 0 and existing.get(p, {}).get("delta") == 0]
        print(f"{len(targets)} places to retry (429 failures)\n")
    else:
        print(f"{len(targets)} places to check\n")

    results = dict(existing)  # keep previously fetched data when retrying
    for i, place in enumerate(targets):
        print(f"[{i+1}/{len(targets)}] {place}...", end=" ", flush=True)
        score, delta = fetch_trend(pytrends, place)
        trend = classify(delta)
        results[place] = {"score": score, "delta": delta, "trend": trend}
        marker = "🔥" if trend == "rising" else "↑" if trend == "up" else "·"
        print(f"{marker} score={score} delta={delta:+d}%")
        if i < len(targets) - 1:
            time.sleep(DELAY)

    out = {
        "updated": datetime.now().strftime("%Y-%m-%d"),
        "reference": REFERENCE,
        "rising_threshold": RISING_THRESHOLD,
        "up_threshold": UP_THRESHOLD,
        "places": results,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    rising = [p for p, v in results.items() if v["trend"] == "rising"]
    up     = [p for p, v in results.items() if v["trend"] == "up"]
    print(f"\n완료 → {OUT_PATH}")
    print(f"🔥 Rising ({len(rising)}): {', '.join(rising) or 'none'}")
    print(f"↑  Trending ({len(up)}): {', '.join(up) or 'none'}")


if __name__ == "__main__":
    main()
