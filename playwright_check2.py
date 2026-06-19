import asyncio
from playwright.async_api import async_playwright

BASE = "http://localhost:7801"

async def check_creators_detail():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        all_errors = []
        all_network_failures = []
        all_console = []

        def on_console(msg):
            all_console.append(f"[{msg.type}] {msg.text}")

        def on_pageerror(exc):
            all_errors.append(f"PAGE ERROR: {exc}")

        def on_requestfailed(req):
            all_network_failures.append(f"FAILED: {req.url} — {req.failure}")

        page.on("console", on_console)
        page.on("pageerror", on_pageerror)
        page.on("requestfailed", on_requestfailed)

        # Also intercept all responses to find 404s
        all_responses = []
        def on_response(resp):
            if resp.status >= 400:
                all_responses.append(f"HTTP {resp.status}: {resp.url}")

        page.on("response", on_response)

        await page.goto(BASE + "/creators.html", timeout=15000, wait_until="networkidle")
        await asyncio.sleep(3)

        print("=== CONSOLE MESSAGES ===")
        for m in all_console:
            print(m)

        print("\n=== PAGE ERRORS ===")
        for e in all_errors:
            print(e)

        print("\n=== FAILED REQUESTS ===")
        for f in all_network_failures:
            print(f)

        print("\n=== HTTP 4xx/5xx RESPONSES ===")
        for r in all_responses:
            print(r)

        # Check where we ended up after redirect
        final_url = page.url
        print(f"\n=== FINAL URL after redirect ===")
        print(final_url)

        # Now check index.html directly for any 404 resources
        page2 = await context.new_page()
        all_errors2 = []
        all_404s = []

        def on_resp2(resp):
            if resp.status >= 400:
                all_404s.append(f"HTTP {resp.status}: {resp.url}")

        def on_pageerror2(exc):
            all_errors2.append(f"PAGE ERROR: {exc}")

        page2.on("response", on_resp2)
        page2.on("pageerror", on_pageerror2)

        await page2.goto(BASE + "/", timeout=15000, wait_until="networkidle")
        await asyncio.sleep(3)

        print("\n=== INDEX.HTML HTTP 4xx RESOURCES ===")
        for r in all_404s:
            print(r)
        print(f"Page errors on index: {all_errors2}")

        await browser.close()

asyncio.run(check_creators_detail())
