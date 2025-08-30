# this code uses the mt cadastral website to extract the address
# it is able to extract the entire address!!

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeoutError
import re
import sys
import json

BASE_URL = "https://svc.mt.gov/msl/cadastral/?page=PropertyDetails&geocode="

ADDRESS_XPATHS = [
    # Label/value pair directly adjacent
    "//div[normalize-space(text())='Address:']/following-sibling::div[1]",
    # Label contains word Address
    "(//div[contains(normalize-space(.),'Address')]/following-sibling::div)[1]",
    # Any element that looks like a value next to a label
    "//*[self::div or self::span][normalize-space(text())='Address:']/following::*[self::div or self::span][1]",
]


def get_property_address(geocode: str) -> dict:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # Navigate
            full_url = BASE_URL + geocode
            page.goto(full_url)

            # Let the SPA finish rendering
            try:
                page.wait_for_load_state("networkidle", timeout=15000)
            except PWTimeoutError:
                pass

            # Also wait until the page shows the same geocode value somewhere
            try:
                page.get_by_text(geocode, exact=False).first.wait_for(state="visible", timeout=8000)
            except PWTimeoutError:
                pass

            # Try multiple precise selectors
            for xp in ADDRESS_XPATHS:
                try:
                    el = page.locator(f"xpath={xp}").first
                    el.wait_for(state="visible", timeout=4000)
                    text = (el.inner_text() or "").strip()
                    text = " ".join(text.split())
                    if _looks_like_full_address(text):
                        return {"success": True, "address": text, "geocode": geocode}
                except Exception:
                    continue

            # Fallback 1: use :has-text relationships (Playwright text engine)
            try:
                label = page.get_by_text("Address:", exact=True).first
                label.wait_for(state="visible", timeout=3000)
                # Take the next sibling element via JS
                sib = label.evaluate_handle("(n) => n.nextElementSibling")
                if sib:
                    txt = (page.evaluate("el => el && el.textContent", sib) or "").strip()
                    txt = " ".join(txt.split())
                    if _looks_like_full_address(txt):
                        return {"success": True, "address": txt, "geocode": geocode}
            except Exception:
                pass

            # Fallback 2: regex scan over whole page text
            try:
                all_text = page.inner_text("body")
                # Match line like: Address: 2324 REHBERG LN BILLINGS, MT 59102
                m = re.search(r"Address:\s*([A-Z0-9 .#'-]+?,\s*MT\s*\d{5}(?:-\d{4})?)", all_text, flags=re.I)
                if m:
                    address = " ".join(m.group(1).split())
                    return {"success": True, "address": address, "geocode": geocode}
            except Exception:
                pass

            return {"success": False, "error": "Address not found for the provided geocode"}
        except Exception as e:
            return {"success": False, "error": f"Error processing geocode: {str(e)}"}
        finally:
            browser.close()


def _looks_like_full_address(s: str) -> bool:
    # crude heuristic for something like: 123 MAIN ST BILLINGS, MT 59102
    return bool(re.search(r",\s*MT\s*\d{5}(?:-\d{4})?$", s))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"success": False, "error": "Geocode argument required"}))
        sys.exit(1)
    
    geocode = sys.argv[1].strip()
    if not geocode:
        print(json.dumps({"success": False, "error": "Empty geocode provided"}))
        sys.exit(1)
    
    result = get_property_address(geocode)
    print(json.dumps(result))
