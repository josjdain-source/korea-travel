"""Direct file-based deploy to Netlify — no GitHub OAuth needed."""
import urllib.request
import json
import os
import hashlib

# Load .env if token not already in environment
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(_env_path):
    for _line in open(_env_path, encoding="utf-8"):
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

NETLIFY_TOKEN = os.environ.get("NETLIFY_TOKEN", "")
if not NETLIFY_TOKEN:
    raise SystemExit("NETLIFY_TOKEN not set. Add it to pipeline/.env")
SITE_ID = "be0e562a-954a-4dc3-a27f-04998f9f383c"
HEADERS = {"Authorization": f"Bearer {NETLIFY_TOKEN}", "User-Agent": "Mozilla/5.0"}

SKIP_DIRS = {"pipeline", "__pycache__", ".git", ".github", "node_modules", "이미지"}
SKIP_EXT = {".pyc", ".zip", ".png", ".jpg", ".jpeg", ".ico", ".mp4", ".webp", ".py"}

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

files = {}
for root, dirs, fnames in os.walk("."):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
    for fname in fnames:
        if any(fname.endswith(e) for e in SKIP_EXT):
            continue
        if fname.startswith("."):
            continue
        path = os.path.join(root, fname)
        rel = path.replace("\\", "/").lstrip("./")
        if not rel:
            continue
        content = open(path, "rb").read()
        sha1 = hashlib.sha1(content).hexdigest()
        files["/" + rel] = sha1

print(f"파일 {len(files)}개 준비")

body = json.dumps({"files": files, "async": False}).encode()
req = urllib.request.Request(
    f"https://api.netlify.com/api/v1/sites/{SITE_ID}/deploys",
    data=body,
    headers={**HEADERS, "Content-Type": "application/json"},
    method="POST",
)
resp = json.loads(urllib.request.urlopen(req, timeout=30).read())
deploy_id = resp["id"]
required = resp.get("required", [])
print(f"deploy_id: {deploy_id}")
print(f"업로드 필요: {len(required)}개 파일")

sha_to_path = {h: p for p, h in files.items()}
for sha1 in required:
    path = sha_to_path.get(sha1)
    if not path:
        continue
    local = path.lstrip("/")
    content = open(local, "rb").read()
    req2 = urllib.request.Request(
        f"https://api.netlify.com/api/v1/deploys/{deploy_id}/files{path}",
        data=content,
        headers={**HEADERS, "Content-Type": "application/octet-stream"},
        method="PUT",
    )
    urllib.request.urlopen(req2, timeout=30)
    print(f"  업로드: {path}")

print()
print("배포 완료 — https://imaginative-snickerdoodle-2e9b76.netlify.app")
