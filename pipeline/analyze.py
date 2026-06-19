"""Groq AI analyzer: video info → structured journey JSON."""
import json
import re
import time
import urllib.request

MODEL = "llama-3.1-8b-instant"  # separate daily quota from 70b; handles simple detection well

SYSTEM = "You are a Korea visit detector. Given a travel creator's video content, determine if they visited Korea and extract the journey. Return ONLY valid JSON. No explanation, no markdown fences."

PROMPT = """A global travel creator posted this video. Detect if they visited Korea and extract what they experienced.

TITLE: {title}
DESCRIPTION: {description}
CAPTIONS: {captions}

Step 1 — Korea visit detection:
- Did the creator physically visit a specific place in South Korea?
- If NO: return {{"skip": true, "reason": "not Korea visit"}}
- Reject: K-pop reviews, Korean food cooked at home, Korea planning/haul videos, reaction videos

Step 2 — If YES, extract:
- Only places CLEARLY visited (no guessing from vague mentions)
- 2-6 moments maximum
- type: food | walking | culture | sightseeing | photo | nature | cafe | drinking | shopping
- description: 2 sentences about what the creator actually did/experienced
- tip: practical advice only if something specific was mentioned
- cost: only if a price was explicitly stated

Return this JSON structure:
{{
  "place": "main destination name",
  "city": "city (e.g. Seoul, Busan, Jeonju)",
  "region": "province/region (e.g. Seoul, Gyeongbuk, Jeju)",
  "reason": "one word: culture|food|nature|adventure",
  "spot": "video title shortened to max 80 chars",
  "moments": [
    {{
      "num": 1,
      "type": "food",
      "title": "short experience title (max 50 chars)",
      "description": "Two sentences about what happened here.",
      "place": {{
        "name": "specific place name (English with Korean if available)"
      }},
      "emotion": ["tag1", "tag2"],
      "replay": {{
        "cost": "₩XX,000 per person (only if mentioned)",
        "tip": "Practical tip for the visitor."
      }}
    }}
  ]
}}"""


_RETRY_DELAYS = [30, 60, 120]  # seconds to wait after each 429

# Groq free: 6,000 TPM. ~1,400 tokens per call → max 4 calls/min → 15s floor delay.
# Caption capped at 2,000 chars (~500 tokens) to stay well under TPM limit.
_CAPTION_CHARS = 2000
_BASE_DELAY = 15


def analyze_video(video_info, api_key):
    """Call Groq with video info, return parsed journey dict. Retries on 429."""
    user_msg = PROMPT.format(
        title=video_info.get("title", ""),
        description=(video_info.get("description") or "")[:800],
        captions=(video_info.get("captions") or "")[:_CAPTION_CHARS],
    )

    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": user_msg},
    ]

    body = json.dumps({
        "model": MODEL,
        "messages": messages,
        "max_tokens": 1800,
        "temperature": 0.2,
    }).encode()

    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "python-requests/2.31.0",
        },
        method="POST",
    )

    time.sleep(_BASE_DELAY)  # Groq free tier: 6,000 TPM → 15s floor

    for attempt, delay in enumerate([0] + _RETRY_DELAYS):
        if delay:
            print(f"    ⏳ 429 — waiting {delay}s before retry {attempt}/{len(_RETRY_DELAYS)}…")
            time.sleep(delay)
        try:
            with urllib.request.urlopen(req) as r:
                resp = json.loads(r.read())
            break
        except Exception as e:
            if "429" in str(e) and attempt < len(_RETRY_DELAYS):
                continue
            raise
    else:
        raise RuntimeError("Groq 429 after all retries")

    raw = resp["choices"][0]["message"]["content"].strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    return json.loads(raw)
