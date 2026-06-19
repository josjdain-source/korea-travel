"""Deploy to Cloudflare Pages via Direct Upload API."""
import os, io, json, hashlib, urllib.request

ACCOUNT_ID = "1feef70717b588bffa9cbe216703f20d"
PROJECT    = "korea-travel"

# Load .env
_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(_env):
    for _l in open(_env, encoding="utf-8"):
        _l = _l.strip()
        if _l and not _l.startswith("#") and "=" in _l:
            k, v = _l.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

TOKEN = os.environ.get("CF_TOKEN", "")
if not TOKEN:
    raise SystemExit("CF_TOKEN not set — add to pipeline/.env")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

SKIP_DIRS  = {"pipeline", "__pycache__", ".git", ".github", "node_modules", "이미지", "backend"}
SKIP_EXT   = {".pyc", ".zip", ".py", ".sql", ".toml", ".code-workspace"}
SKIP_NAMES = {"ARCHITECTURE.md", "README.md"}

# Collect files: {"/path": (sha256, bytes)}
files = {}
for root, dirs, fnames in os.walk("."):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
    for fname in fnames:
        if any(fname.endswith(e) for e in SKIP_EXT) or fname.startswith(".") or fname in SKIP_NAMES:
            continue
        path = os.path.join(root, fname)
        arcname = "/" + path.replace("\\", "/").lstrip("./")
        if not arcname or arcname == "/":
            continue
        data = open(path, "rb").read()
        sha = hashlib.sha256(data).hexdigest()
        files[arcname] = (sha, data)

print(f"파일 {len(files)}개 준비")

# Build multipart body:
# - "manifest" part: JSON {"/path": "sha256", ...}
# - one part per file named by its sha256
manifest = {p: s for p, (s, _) in files.items()}
boundary = b"----cfpagesboundary7z9x"

def part(name, content, content_type=b"application/octet-stream"):
    if isinstance(name, str):
        name = name.encode()
    if isinstance(content, str):
        content = content.encode()
    return (
        b"--" + boundary + b"\r\n"
        b'Content-Disposition: form-data; name="' + name + b'"\r\n'
        b"Content-Type: " + content_type + b"\r\n\r\n"
        + content + b"\r\n"
    )

body_parts = [
    part("manifest", json.dumps(manifest), b"application/json"),
    part("branch", "main", b"text/plain"),
]
seen_hashes = set()
for arcname, (sha, data) in files.items():
    if sha not in seen_hashes:
        body_parts.append(part(sha, data))
        seen_hashes.add(sha)

body = b"".join(body_parts) + b"--" + boundary + b"--\r\n"

req = urllib.request.Request(
    f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/pages/projects/{PROJECT}/deployments",
    data=body,
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": f"multipart/form-data; boundary={boundary.decode()}",
    },
    method="POST",
)

try:
    resp = json.loads(urllib.request.urlopen(req, timeout=120).read())
    url = resp.get("result", {}).get("url", f"https://{PROJECT}.pages.dev")
    print(f"\n배포 완료 → {url}")
    print(f"메인 주소 → https://{PROJECT}.pages.dev")
except urllib.error.HTTPError as e:
    print(f"오류 {e.code}: {e.read().decode()}")
    raise
