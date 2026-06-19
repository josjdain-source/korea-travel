"""
Creator density report.
Usage: python pipeline/report.py
"""
import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from config import CREATORS, VISITS_FILE

STATS_FILE = Path(__file__).parent / "creator_stats.json"


def main():
    stats = json.loads(STATS_FILE.read_text()) if STATS_FILE.exists() else {}
    visits = json.load(open(VISITS_FILE, encoding="utf-8")).get("visits", [])

    # Count moments per creator from visits.json
    moment_counts = {}
    for v in visits:
        cid = v.get("creatorId", "")
        moment_counts[cid] = moment_counts.get(cid, 0) + len(v.get("moments") or [])

    # Build rows
    rows = []
    for c in CREATORS:
        cid = c["id"]
        s = stats.get(cid, {})
        scanned = s.get("scanned", 0)
        korea   = s.get("korea", 0)
        skip    = s.get("skip", 0)
        moments = moment_counts.get(cid, 0)
        rate    = f"{korea/scanned*100:.0f}%" if scanned else "-"
        rows.append((c.get("country", "?"), cid, scanned, korea, skip, moments, rate))

    rows.sort(key=lambda r: (-r[3], -r[2]))  # sort by korea desc, then scanned desc

    # Print table
    print(f"\n{'─'*80}")
    print(f"  Creator Density Report")
    print(f"{'─'*80}")
    print(f"  {'Country':<6} {'Creator':<22} {'Scanned':>7} {'Korea':>6} {'Skip':>5} {'Moments':>7} {'Rate':>5}")
    print(f"  {'─'*6} {'─'*22} {'─'*7} {'─'*6} {'─'*5} {'─'*7} {'─'*5}")
    for country, cid, scanned, korea, skip, moments, rate in rows:
        print(f"  {country:<6} {cid:<22} {scanned:>7} {korea:>6} {skip:>5} {moments:>7} {rate:>5}")

    # Summary by country
    from collections import defaultdict
    by_country = defaultdict(lambda: {"korea": 0, "scanned": 0, "moments": 0})
    for country, cid, scanned, korea, skip, moments, rate in rows:
        by_country[country]["korea"]   += korea
        by_country[country]["scanned"] += scanned
        by_country[country]["moments"] += moments

    print(f"\n{'─'*80}")
    print(f"  Country Summary")
    print(f"{'─'*80}")
    print(f"  {'Country':<8} {'Scanned':>7} {'Korea':>6} {'Moments':>7}")
    print(f"  {'─'*8} {'─'*7} {'─'*6} {'─'*7}")
    for country, d in sorted(by_country.items(), key=lambda x: -x[1]["korea"]):
        print(f"  {country:<8} {d['scanned']:>7} {d['korea']:>6} {d['moments']:>7}")

    total_korea   = sum(r[3] for r in rows)
    total_moments = sum(r[5] for r in rows)
    print(f"\n  Total Korea visits : {total_korea}")
    print(f"  Total Moments      : {total_moments}")
    print(f"{'─'*80}\n")


if __name__ == "__main__":
    main()
