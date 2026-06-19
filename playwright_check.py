import asyncio
import json
from playwright.async_api import async_playwright

BASE = "http://localhost:7801"

PAGES = [
    ("/", "index"),
    ("/ranking.html", "ranking"),
    ("/find.html", "find"),
    ("/quiz.html", "quiz"),
    ("/place.html?place=Jeonju%20Hanok%20Village&mode=place", "place"),
    ("/route.html?creator=lost-then-found", "route (lost-then-found)"),
    ("/route.html?creator=joel-bennett", "route (joel-bennett)"),
    ("/tribe.html", "tribe"),
    ("/tribe.html?id=Hidden%20Path%20Explorer%20%F0%9F%A7%AD", "tribe (specific)"),
    ("/live.html", "live"),
    ("/graph.html", "graph"),
    ("/creators.html", "creators"),
]

async def check_page(page, path, label):
    url = BASE + path
    errors = []
    warnings = []

    def on_console(msg):
        if msg.type == "error":
            errors.append(f"JS ERROR: {msg.text}")
        elif msg.type == "warning":
            warnings.append(f"JS WARN: {msg.text}")

    def on_pageerror(exc):
        errors.append(f"PAGE ERROR: {exc}")

    page.on("console", on_console)
    page.on("pageerror", on_pageerror)

    failed_requests = []
    def on_requestfailed(req):
        failed_requests.append(f"FAILED REQUEST: {req.url}")

    page.on("requestfailed", on_requestfailed)

    try:
        resp = await page.goto(url, timeout=15000, wait_until="domcontentloaded")
        status = resp.status if resp else "no response"
    except Exception as e:
        return {
            "label": label,
            "path": path,
            "status": "LOAD_ERROR",
            "errors": [str(e)],
            "warnings": [],
            "content_ok": False,
            "body_text_sample": "",
            "failed_requests": [],
        }

    await asyncio.sleep(2)

    # Check body has visible content
    try:
        body_text = await page.evaluate("() => document.body ? document.body.innerText.trim() : ''")
        body_text_sample = body_text[:300].replace("\n", " ")
    except Exception as e:
        body_text_sample = f"[eval error: {e}]"
        body_text = ""

    # Blank / error screen checks
    content_ok = len(body_text.strip()) > 30

    # Check for error-like text in page
    error_phrases = ["404", "cannot get", "not found", "error", "undefined", "null"]
    for phrase in error_phrases:
        if phrase in body_text.lower()[:200]:
            warnings.append(f"Suspicious text in page: '{phrase}'")

    # Check main structural elements exist
    try:
        has_nav = await page.evaluate("() => !!document.querySelector('nav, header, .nav, #nav')")
        has_main = await page.evaluate("() => !!document.querySelector('main, .container, #app, #content, .content, section, .page')")
    except:
        has_nav = False
        has_main = False

    if not has_main:
        warnings.append("No main content element found")

    return {
        "label": label,
        "path": path,
        "status": status,
        "errors": errors,
        "warnings": warnings,
        "content_ok": content_ok,
        "has_nav": has_nav,
        "has_main": has_main,
        "body_text_sample": body_text_sample,
        "failed_requests": failed_requests,
    }

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()

        results = []
        for path, label in PAGES:
            page = await context.new_page()
            result = await check_page(page, path, label)
            results.append(result)
            await page.close()

        await browser.close()

    # Print results
    print("\n" + "="*80)
    print("PLAYWRIGHT PAGE CHECK RESULTS")
    print("="*80 + "\n")

    for r in results:
        has_errors = len(r["errors"]) > 0
        has_warnings = len(r["warnings"]) > 0
        content_ok = r.get("content_ok", False)
        status = r.get("status", "?")

        if r["status"] == "LOAD_ERROR":
            icon = "❌"
        elif has_errors:
            icon = "❌"
        elif not content_ok:
            icon = "❌"
        elif has_warnings:
            icon = "⚠️"
        else:
            icon = "✅"

        print(f"{icon} [{r['label']}] {r['path']}")
        print(f"   HTTP: {status} | content_ok: {content_ok} | nav: {r.get('has_nav','?')} | main: {r.get('has_main','?')}")

        if r["errors"]:
            for e in r["errors"]:
                print(f"   ❌ {e}")

        if r["warnings"]:
            for w in r["warnings"]:
                print(f"   ⚠️  {w}")

        if r["failed_requests"]:
            for fr in r["failed_requests"]:
                print(f"   🔗 {fr}")

        print(f"   📄 body sample: {r['body_text_sample'][:200]}")
        print()

    # Summary table
    print("\n" + "="*80)
    print("SUMMARY TABLE")
    print("="*80)
    print(f"{'Page':<35} {'Status':>6} {'Content':>8} {'Errors':>7} {'Warns':>6}")
    print("-"*80)
    for r in results:
        err_count = len(r["errors"])
        warn_count = len(r["warnings"])
        content_ok = "OK" if r.get("content_ok") else "EMPTY"
        if r["status"] == "LOAD_ERROR":
            icon = "❌"
        elif err_count > 0:
            icon = "❌"
        elif not r.get("content_ok"):
            icon = "❌"
        elif warn_count > 0:
            icon = "⚠️ "
        else:
            icon = "✅"
        print(f"{icon} {r['label']:<33} {str(r['status']):>6} {content_ok:>8} {err_count:>7} {warn_count:>6}")

    print("\nDone.")

asyncio.run(main())
