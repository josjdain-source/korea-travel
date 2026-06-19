"""Writer: update visits.json + push to Supabase."""
import json
import requests


def write_visit(visit, visits_path, supabase_url="", service_key=""):
    """
    Append visit to visits.json (prepend = newest first).
    Returns True if written, False if duplicate.
    """
    with open(visits_path, encoding="utf-8") as f:
        data = json.load(f)

    existing = {v.get("videoUrl", "") for v in data.get("visits", [])}
    if visit.get("videoUrl") in existing:
        return False

    data["visits"].insert(0, visit)

    with open(visits_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    if supabase_url and service_key:
        _push_supabase(visit, supabase_url, service_key)

    return True


def _push_supabase(visit, url, key):
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    # Insert into creator_visits (camelCase → snake_case)
    camel_to_snake = {
        "creatorId": "creator_id",
        "videoUrl":  "video_url",
    }
    row = {}
    for k, v in visit.items():
        if k == "moments":
            continue
        row[camel_to_snake.get(k, k)] = v
    r = requests.post(f"{url}/rest/v1/creator_visits", headers=headers, json=row)
    if r.status_code not in (200, 201):
        print(f"    Supabase creator_visits error: {r.status_code} {r.text[:120]}")
        return

    visit_id = r.json()[0]["id"]

    # Insert moments
    for m in visit.get("moments") or []:
        p = m.get("place") or {}
        mrow = {
            "visit_id": visit_id,
            "num": m.get("num"),
            "type": m.get("type"),
            "title": m.get("title"),
            "description": m.get("description"),
            "place_name": p.get("name"),
            "lat": p.get("lat"),
            "lng": p.get("lng"),
            "emotion": m.get("emotion") or [],
            "replay_cost": (m.get("replay") or {}).get("cost"),
            "replay_tip": (m.get("replay") or {}).get("tip"),
        }
        requests.post(f"{url}/rest/v1/creator_moments", headers=headers, json=mrow)
