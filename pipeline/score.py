"""Korea relevance scorer — 4-tier filter before expensive LLM calls."""

# Tier 1 metadata keywords (title + description + tags)
HIGH = [
    "seoul", "busan", "jeju", "incheon", "daegu", "gwangju", "daejeon",
    "jeonju", "gyeongju", "suwon", "korea", "korean", "한국", "서울", "부산",
    "제주", "인천",
]

PLACES = [
    "myeongdong", "hongdae", "gangnam", "insadong", "itaewon", "bukchon",
    "dongdaemun", "namdaemun", "sinchon", "mapo", "yeouido", "jongno",
    "gwangjang", "noryangjin", "mangwon", "ikseon", "seongsu",
    "haeundae", "jagalchi", "nampo", "bupyeong",
]

MEDIUM = [
    "kbbq", "k-bbq", "korean bbq", "korean food", "korean street food",
    "k-food", "bibimbap", "bulgogi", "tteokbokki", "samgyeopsal",
    "kimchi", "soju", "makgeolli", "hanbok", "hanok", "hallyu",
    "k-pop tour", "korea vlog", "korea trip", "visit korea",
]

SCORE_THRESHOLD = 5  # minimum metadata score to proceed to caption fetch

# Tier 3: caption must contain at least one of these to proceed to LLM.
# Catches "korean-englishman in UK" type creators whose metadata always scores high
# but captions never mention actual Korea locations.
CAPTION_REQUIRED = [
    "seoul", "busan", "jeju", "incheon", "daegu", "jeonju", "gyeongju",
    "korea", "한국", "서울", "부산", "제주", "인천",
    "myeongdong", "hongdae", "gangnam", "insadong", "itaewon", "bukchon",
    "dongdaemun", "haeundae",
]

CAPTION_MIN_HITS = 1  # caption must match at least this many keywords


def korea_score(video_meta: dict) -> int:
    """Score Korea relevance from flat-playlist metadata. Threshold: SCORE_THRESHOLD."""
    text = " ".join([
        video_meta.get("title", ""),
        video_meta.get("description", ""),
        " ".join(video_meta.get("tags") or []),
    ]).lower()

    score = 0
    for kw in HIGH:
        if kw in text:
            score += 5
    for kw in PLACES:
        if kw in text:
            score += 3
    for kw in MEDIUM:
        if kw in text:
            score += 2

    return score


def caption_confirms_korea(captions: str) -> bool:
    """
    Tier-3 gate: caption text must contain at least one hard Korea keyword.
    Blocks 'korean-englishman in London' type false positives before LLM call.
    """
    if not captions:
        return False
    text = captions.lower()
    hits = sum(1 for kw in CAPTION_REQUIRED if kw in text)
    return hits >= CAPTION_MIN_HITS
