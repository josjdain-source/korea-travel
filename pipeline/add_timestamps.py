"""Backfill moment timestamps using yt-dlp captions + Groq."""
import json, os, re, time, tempfile, urllib.request
import yt_dlp

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(_env):
    for _l in open(_env, encoding="utf-8"):
        _l = _l.strip()
        if _l and not _l.startswith("#") and "=" in _l:
            k, v = _l.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

GROQ_KEY = os.environ.get("GROQ_API_KEY", "")
if not GROQ_KEY:
    raise SystemExit("GROQ_API_KEY not set")

MODEL = "llama-3.1-8b-instant"


def fetch_captions_with_timestamps(video_url):
    """Return '[Ns] text' lines from VTT captions, or empty string."""
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            opts = {
                "writesubtitles": True,
                "writeautomaticsub": True,
                "subtitleslangs": ["ko", "en"],
                "subtitlesformat": "vtt",
                "skip_download": True,
                "quiet": True,
                "no_warnings": True,
                "ignoreerrors": True,
                "outtmpl": os.path.join(tmpdir, "%(id)s"),
            }
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(video_url, download=False)
                vid_id = info.get("id", "")
                ydl.download([video_url])

            for lang in ["ko", "en"]:
                for ext in ["vtt", "srt"]:
                    path = os.path.join(tmpdir, f"{vid_id}.{lang}.{ext}")
                    if os.path.exists(path):
                        raw = open(path, encoding="utf-8", errors="ignore").read()
                        return _parse_timestamped(raw)
    except Exception as e:
        print(f"    captions error: {e}")
    return ""


def _parse_timestamped(text):
    """Parse VTT → '[Ns] text' lines. Samples every 3rd segment, max 80."""
    segments = []
    current_sec = None
    current_words = []

    for line in text.splitlines():
        line = line.strip()
        if not line or "WEBVTT" in line:
            continue
        if re.match(r"^\d+$", line):
            continue
        if "-->" in line:
            if current_words and current_sec is not None:
                segments.append(f"[{current_sec}s] {' '.join(current_words)}")
                current_words = []
            m = re.match(r"(\d+):(\d{2}):(\d{2})", line)
            if m:
                h, mn, s = int(m.group(1)), int(m.group(2)), int(m.group(3))
                current_sec = h * 3600 + mn * 60 + s
        else:
            clean = re.sub(r"<[^>]+>", "", line).strip()
            if clean and (not current_words or clean != current_words[-1]):
                current_words.append(clean)

    if current_words and current_sec is not None:
        segments.append(f"[{current_sec}s] {' '.join(current_words)}")

    return "\n".join(segments[::3][:80])


def groq_timestamps(moments, captions, api_key):
    """Return list of int seconds (or None) aligned to moments list."""
    moment_list = "\n".join(f"{i+1}. {m['title']}" for i, m in enumerate(moments))

    prompt = f"""Captions from a YouTube travel video (format: [Ns] = N seconds into video):

{captions[:3000]}

Find the approximate start time (seconds) for each moment listed below.
Return ONLY a JSON array of integers (one per moment). Use null if not found.
Example for 3 moments: [42, 187, null]

MOMENTS:
{moment_list}"""

    body = json.dumps({
        "model": MODEL,
        "messages": [
            {"role": "system", "content": "Return only valid JSON array. No explanation."},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 100,
        "temperature": 0.1,
    }).encode()

    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    time.sleep(15)  # Groq free tier: 6,000 TPM

    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                resp = json.loads(r.read())
            raw = resp["choices"][0]["message"]["content"].strip()
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
            result = json.loads(raw)
            if isinstance(result, list):
                return result
        except Exception as e:
            if "429" in str(e) and attempt < 3:
                wait = [30, 60, 120][attempt]
                print(f"    429 — waiting {wait}s…")
                time.sleep(wait)
                continue
            print(f"    Groq error: {e}")
            break
    return []


def main():
    visits_path = os.path.join(ROOT, "data", "visits.json")
    data = json.load(open(visits_path, encoding="utf-8"))
    visits = data.get("visits", [])

    to_process = [
        (i, v) for i, v in enumerate(visits)
        if v.get("moments") and any("timestamp" not in m for m in v["moments"])
    ]
    print(f"Visits to process: {len(to_process)}")

    for idx, (vi, visit) in enumerate(to_process):
        url = visit.get("videoUrl", "")
        place = visit.get("place", "?")
        print(f"[{idx+1}/{len(to_process)}] {place} — {url}")

        captions = fetch_captions_with_timestamps(url)
        if not captions:
            print("    no captions, skipping")
            continue

        timestamps = groq_timestamps(visit["moments"], captions, GROQ_KEY)

        for j, m in enumerate(visit["moments"]):
            ts = timestamps[j] if j < len(timestamps) else None
            if isinstance(ts, (int, float)) and ts >= 0:
                m["timestamp"] = int(ts)
                print(f"    moment {j+1} '{m['title']}': {int(ts)}s")
            else:
                print(f"    moment {j+1} '{m['title']}': not found")

        # Save after each video so progress is preserved on interrupt
        json.dump(data, open(visits_path, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)

    print(f"\nDone. {len(to_process)} visits processed.")


if __name__ == "__main__":
    main()
