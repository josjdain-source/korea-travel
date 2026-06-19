import asyncio
from playwright.async_api import async_playwright

BASE = "http://localhost:7801"

PAGES_WITH_SUPABASE = [
    ("/place.html?place=Jeonju%20Hanok%20Village&mode=place", "place"),
    ("/route.html?creator=lost-then-found", "route (lost-then-found)"),
    ("/route.html?creator=joel-bennett", "route (joel-bennett)"),
    ("/live.html", "live"),
]

async def check_supabase(page, path, label):
    url = BASE + path
    failed = []
    errors_4xx = []
    console_errors = []

    page.on("requestfailed", lambda req: failed.append(req.url))
    page.on("response", lambda r: errors_4xx.append(f"HTTP {r.status}: {r.url}") if r.status >= 400 else None)
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

    await page.goto(url, timeout=15000, wait_until="networkidle")
    await asyncio.sleep(2)

    supabase_fails = [u for u in failed if "supabase" in u]
    supabase_4xx = [u for u in errors_4xx if "supabase" in u]

    print(f"\n--- {label} ({path}) ---")
    if supabase_fails:
        for f in supabase_fails:
            print(f"  NETWORK FAIL: {f}")
    if supabase_4xx:
        for e in supabase_4xx:
            print(f"  {e}")
    if not supabase_fails and not supabase_4xx:
        print("  No Supabase failures detected")
    if console_errors:
        for e in console_errors:
            print(f"  JS ERROR: {e}")

    # Check if page rendered content despite failure
    body_text = await page.evaluate("() => document.body.innerText.trim()")
    content_ok = len(body_text) > 100
    print(f"  Content visible: {'YES' if content_ok else 'NO'} ({len(body_text)} chars)")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()

        print("=== SUPABASE FAILURE DIAGNOSTIC ===")
        for path, label in PAGES_WITH_SUPABASE:
            page = await context.new_page()
            await check_supabase(page, path, label)
            await page.close()

        await browser.close()

asyncio.run(main())
