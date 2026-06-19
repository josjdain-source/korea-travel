"""YouTube fetcher: channel video list + captions via yt-dlp."""
import re
import os
import tempfile
import yt_dlp


def get_channel_videos(channel_url, max_videos=5):
    """Return list of recent video dicts from a YouTube channel."""
    ydl_opts = {
        "extract_flat": True,
        "playlistend": max_videos,
        "quiet": True,
        "no_warnings": True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(channel_url + "/videos", download=False)
        entries = info.get("entries") or []
        return [
            {
                "id": e.get("id", ""),
                "url": f"https://www.youtube.com/watch?v={e.get('id', '')}",
                "title": e.get("title", ""),
                "description": (e.get("description") or "")[:500],
                "tags": e.get("tags") or [],
                "view_count": e.get("view_count") or 0,
                "upload_date": e.get("upload_date") or "",
            }
            for e in entries if e.get("id")
        ]
    except Exception as e:
        print(f"    channel fetch error: {e}")
        return []


def fetch_video_info(video_url):
    """
    Fetch video metadata + captions.
    Returns dict with id, title, description, view_count, upload_date, captions.
    Captions may be empty (429 / no subs) — caller proceeds with title+description only.
    """
    # Step 1: metadata only (fast, no rate-limit risk)
    meta_opts = {
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
    }
    with yt_dlp.YoutubeDL(meta_opts) as ydl:
        info = ydl.extract_info(video_url, download=False)

    vid_id = info.get("id", "")
    date = info.get("upload_date", "")
    if len(date) == 8:
        date = f"{date[:4]}-{date[4:6]}"

    result = {
        "id": vid_id,
        "title": info.get("title", ""),
        "description": (info.get("description") or "")[:2000],
        "view_count": info.get("view_count") or 0,
        "upload_date": date,
        "url": video_url,
        "captions": "",
    }

    # Step 2: try to get captions (best-effort, non-fatal)
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            cap_opts = {
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
            with yt_dlp.YoutubeDL(cap_opts) as ydl:
                ydl.download([video_url])
            result["captions"] = _read_captions(tmpdir, vid_id)[:6000]
    except Exception:
        pass  # proceed without captions

    return result


def _read_captions(tmpdir, vid_id):
    for lang in ["ko", "en"]:
        for ext in ["vtt", "srt"]:
            path = os.path.join(tmpdir, f"{vid_id}.{lang}.{ext}")
            if os.path.exists(path):
                raw = open(path, encoding="utf-8", errors="ignore").read()
                return _parse_vtt(raw)
    return ""


def _parse_vtt(text):
    lines = []
    for line in text.splitlines():
        line = line.strip()
        if not line or "WEBVTT" in line or "-->" in line:
            continue
        if re.match(r"^\d+$", line):
            continue
        line = re.sub(r"<[^>]+>", "", line)
        if line:
            lines.append(line)
    # deduplicate consecutive identical lines (auto-captions repeat)
    deduped = [lines[0]] if lines else []
    for l in lines[1:]:
        if l != deduped[-1]:
            deduped.append(l)
    return " ".join(deduped)
