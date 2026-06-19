import os
from pathlib import Path

# Load .env if present
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

ANTHROPIC_API_KEY    = os.getenv("ANTHROPIC_API_KEY", "")
GEMINI_API_KEY       = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY         = os.getenv("GROQ_API_KEY", "")
SUPABASE_URL         = "https://nmzngmmaxcqrtdryubsd.supabase.co"
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

VISITS_FILE    = str(Path(__file__).parent.parent / "data" / "visits.json")
PROCESSED_FILE = str(Path(__file__).parent / "processed.json")
MAX_PER_CREATOR = 2   # new videos to process per creator per run

# Creator-first strategy:
# Monitor global travel/food/lifestyle creators → detect Korea visits → extract journey
# NOT searching for Korea videos — watching known creators for when they visit Korea

CREATORS = [
    # US — food & travel
    {"id": "mark-wiens",        "country": "US", "url": "https://www.youtube.com/@MarkWiens"},
    {"id": "drew-binsky",       "country": "US", "url": "https://www.youtube.com/@drewbinsky"},
    {"id": "yes-theory",        "country": "US", "url": "https://www.youtube.com/@YesTheory"},
    {"id": "kara-and-nate",     "country": "US", "url": "https://www.youtube.com/@karaandnate"},
    {"id": "wolters-world",     "country": "US", "url": "https://www.youtube.com/@WoltersWorld"},
    {"id": "strictly-dumpling", "country": "US", "url": "https://www.youtube.com/@StrictlyDumpling"},

    # CA — food & travel
    {"id": "the-food-ranger",   "country": "CA", "url": "https://www.youtube.com/@TheFoodRanger"},
    {"id": "lost-leblancs",     "country": "CA", "url": "https://www.youtube.com/@LostLeBlancs"},

    # UK
    {"id": "korean-englishman", "country": "UK", "url": "https://www.youtube.com/@KoreanEnglishman"},
    {"id": "noel-philips",      "country": "UK", "url": "https://www.youtube.com/@NoelPhilips"},

    # AU
    {"id": "indigo-traveller",  "country": "AU", "url": "https://www.youtube.com/@IndigoTraveller"},
    {"id": "fearless-and-far",  "country": "AU", "url": "https://www.youtube.com/@FearlessandFar"},

    # JP — Asia-based, high Korea overlap
    {"id": "paolo-fromtokyo",   "country": "JP", "url": "https://www.youtube.com/@PaolofromTOKYO"},
    {"id": "abroad-in-japan",   "country": "JP", "url": "https://www.youtube.com/@AbroadinJapan"},

    # VN / TH / SE Asia-based food travel
    {"id": "best-ever-food",    "country": "VN", "url": "https://www.youtube.com/@BestEverFoodReviewShow"},

    # Korea-resident foreigners (ground-truth source)
    {"id": "eatyourkimchi",     "country": "CA", "url": "https://www.youtube.com/@EatYourKimchi"},
    {"id": "joel-bennett",      "country": "UK", "url": "https://www.youtube.com/@JoelBennettKorea"},
    {"id": "2hearts1seoul",     "country": "US", "url": "https://www.youtube.com/@2HEARTS1SEOUL"},
    {"id": "igobart",           "country": "PL", "url": "https://www.youtube.com/@iGoBart"},
    {"id": "gap-year-at-30",    "country": "UK", "url": "https://www.youtube.com/@GapYearAt30"},
    {"id": "lost-then-found",   "country": "US", "url": "https://www.youtube.com/@lostthenfound"},
    {"id": "amyah-maze",        "country": "US", "url": "https://www.youtube.com/@amyahmaze"},
    {"id": "cari-cakes",        "country": "US", "url": "https://www.youtube.com/@caricakes"},
]
