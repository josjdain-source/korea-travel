"""Add video duration to visits using yt-dlp (no LLM needed).

Frame timestamps are derived from duration:
  1.jpg = 25%,  2.jpg = 50%,  3.jpg = 75%  of video length.
"""
import json, os, time
import yt_dlp

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_duration(video_url):
    opts = {"skip_download": True, "quiet": True, "no_warnings": True}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            return info.get("duration")  # seconds (int)
    except Exception as e:
        print(f"    error: {e}")
        return None


def main():
    path = os.path.join(ROOT, "data", "visits.json")
    data = json.load(open(path, encoding="utf-8"))
    visits = data.get("visits", [])

    to_do = [v for v in visits if v.get("videoUrl") and not v.get("duration")]
    print(f"Visits needing duration: {len(to_do)}")

    for i, visit in enumerate(to_do):
        url = visit["videoUrl"]
        print(f"[{i+1}/{len(to_do)}] {visit.get('place','?')} — ", end="", flush=True)
        dur = get_duration(url)
        if dur:
            visit["duration"] = dur
            print(f"{dur}s")
        else:
            print("failed")

        # Save every 10 videos
        if (i + 1) % 10 == 0:
            json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

        time.sleep(1)  # polite delay

    json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\nDone. {sum(1 for v in visits if v.get('duration'))} visits have duration.")


if __name__ == "__main__":
    main()
