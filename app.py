# app.py
import os
import asyncio
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from playwright.async_api import async_playwright

app = FastAPI()

CADASTRAL_BASE = "https://svc.mt.gov/msl/cadastral/?page=PropertyDetails&geocode="

# A small helper so we reuse a single browser across requests (faster/cheaper)
playwright_singleton = {"pw": None, "browser": None}

async def get_browser():
    if playwright_singleton["pw"] is None:
        playwright_singleton["pw"] = await async_playwright().start()
    if playwright_singleton["browser"] is None:
        # Use no-sandbox flags for restricted containers
        playwright_singleton["browser"] = await playwright_singleton["pw"].chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
    return playwright_singleton["browser"]

@app.get("/lookup")
async def lookup(geocode: str = Query(..., min_length=5)):
    url = CADASTRAL_BASE + geocode.strip()

    browser = await get_browser()
    context = await browser.new_context(
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        )
    )
    page = await context.new_page()

    try:
        # Navigate and wait for network to settle (site is JS-heavy)
        await page.goto(url, wait_until="networkidle", timeout=45000)

        # Strategy 1: look for a clean label "Property Address" and its value sibling
        # Adjust selectors if the site's DOM changes.
        label = await page.locator("//div[contains(., 'Property Address')]").first

        if await label.count() == 0:
            # Try another approach: the site sometimes uses table rows or definition lists
            # Scan for a known pattern
            all_text = await page.text_content("body")
            if all_text and "Property Address" in all_text:
                # Fallback: try to grab the next sibling <div> after the label pattern
                value = await page.locator(
                    "//div[normalize-space()='Property Address']/following-sibling::div[1]"
                ).first
                if await value.count() > 0:
                    address = (await value.text_content() or "").strip()
                else:
                    address = None
            else:
                address = None
        else:
            # The common structure is label in one <div> and the value in the following sibling <div>
            value = await page.locator(
                "//div[contains(., 'Property Address')]/following-sibling::div[1]"
            ).first
            address = (await value.text_content() or "").strip() if await value.count() > 0 else None

        if not address:
            # Try a looser CSS pattern as another fallback
            possible = await page.locator("text=Property Address").first
            if await possible.count() > 0:
                # Walk DOM via JS to fetch next sibling's text
                handle = await possible.element_handle()
                next_sibling = await page.evaluate_handle(
                    "(el) => el.nextElementSibling ? el.nextElementSibling.innerText : null", handle
                )
                address = (await next_sibling.json_value()) if next_sibling else None
                address = address.strip() if address else None

        if not address:
            raise HTTPException(status_code=404, detail="Address not found on the page.")

        return JSONResponse({"geocode": geocode, "address": address})

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lookup failed: {e}")
    finally:
        await context.close()

@app.get("/")
def root():
    return {"ok": True, "message": "Use /lookup?geocode=XX-XXXX-..."}