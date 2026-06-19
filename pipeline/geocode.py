"""Geocoder: place name → (lat, lng) via Nominatim (free, no key needed)."""
import time
import requests

_URL = "https://nominatim.openstreetmap.org/search"
_HEADERS = {"User-Agent": "KoreaRouteBot/1.0 (josjdain@gmail.com)"}


def geocode(place_name, city=""):
    """Return {"lat": float, "lng": float} or None."""
    query = f"{place_name}, {city}, South Korea" if city else f"{place_name}, South Korea"
    params = {"q": query, "format": "json", "limit": 1, "countrycodes": "kr"}
    try:
        time.sleep(1.1)  # Nominatim policy: max 1 req/sec
        r = requests.get(_URL, params=params, headers=_HEADERS, timeout=10)
        data = r.json()
        if data:
            return {"lat": float(data[0]["lat"]), "lng": float(data[0]["lon"])}
    except Exception as e:
        print(f"    geocode error [{place_name}]: {e}")
    return None


def geocode_moments(moments, city=""):
    """Mutate moments list: add lat/lng to each place that has a name."""
    for m in moments:
        place = m.get("place") or {}
        if place.get("name") and "lat" not in place:
            coords = geocode(place["name"], city)
            if coords:
                place["lat"] = coords["lat"]
                place["lng"] = coords["lng"]
    return moments
