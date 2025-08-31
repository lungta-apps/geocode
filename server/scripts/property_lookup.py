# this code uses the mt cadastral website to extract the address
# improved version with better deployment compatibility

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeoutError
import re
import sys
import json

BASE_URL = "https://svc.mt.gov/msl/cadastral/?page=PropertyDetails&geocode="

def get_property_address(geocode: str) -> dict:
    with sync_playwright() as p:
        # Use deployment-friendly browser args from the new script
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
        
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        )
        page = context.new_page()

        try:
            # Navigate with improved timeout settings
            full_url = BASE_URL + geocode
            page.goto(full_url, wait_until="networkidle", timeout=45000)

            # Strategy 1: look for a clean label "Property Address" and its value sibling
            # This is from the new script's approach
            try:
                label = page.locator("//div[contains(., 'Property Address')]").first
                if label.count() > 0:
                    value = page.locator(
                        "//div[contains(., 'Property Address')]/following-sibling::div[1]"
                    ).first
                    if value.count() > 0:
                        address = (value.text_content() or "").strip()
                        if _looks_like_full_address(address):
                            return {"success": True, "address": address, "geocode": geocode}
            except Exception:
                pass

            # Strategy 2: try the original XPath approaches
            ADDRESS_XPATHS = [
                "//div[normalize-space(text())='Address:']/following-sibling::div[1]",
                "(//div[contains(normalize-space(.),'Address')]/following-sibling::div)[1]",
                "//*[self::div or self::span][normalize-space(text())='Address:']/following::*[self::div or self::span][1]",
                "//div[normalize-space()='Property Address']/following-sibling::div[1]"
            ]

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

            # Strategy 3: use the new script's fallback approach
            all_text = page.text_content("body")
            if all_text and "Property Address" in all_text:
                # Try to find the value following the Property Address label
                value = page.locator(
                    "//div[normalize-space()='Property Address']/following-sibling::div[1]"
                ).first
                if value.count() > 0:
                    address = (value.text_content() or "").strip()
                    if _looks_like_full_address(address):
                        return {"success": True, "address": address, "geocode": geocode}

            # Strategy 4: improved text-based search using Playwright's text engine
            try:
                label = page.get_by_text("Property Address", exact=False).first
                if label.count() > 0:
                    label.wait_for(state="visible", timeout=3000)
                    # Walk DOM via JS to fetch next sibling's text
                    handle = label.element_handle()
                    if handle:
                        next_sibling = page.evaluate_handle(
                            "(el) => el.nextElementSibling ? el.nextElementSibling.innerText : null", handle
                        )
                        if next_sibling:
                            address = next_sibling.json_value()
                            if address and _looks_like_full_address(address.strip()):
                                return {"success": True, "address": address.strip(), "geocode": geocode}
            except Exception:
                pass

            # Strategy 5: regex scan over whole page text (original fallback)
            try:
                all_text = page.inner_text("body")
                # Match line like: Address: 2324 REHBERG LN BILLINGS, MT 59102
                m = re.search(r"(?:Property\s+)?Address:\s*([A-Z0-9 .#'-]+?,\s*MT\s*\d{5}(?:-\d{4})?)", all_text, flags=re.I)
                if m:
                    address = " ".join(m.group(1).split())
                    return {"success": True, "address": address, "geocode": geocode}
            except Exception:
                pass

            return {"success": False, "error": "Address not found for the provided geocode"}

        except Exception as e:
            return {"success": False, "error": f"Error processing geocode: {str(e)}"}
        finally:
            context.close()
            browser.close()


def _looks_like_full_address(s: str) -> bool:
    # improved heuristic for something like: 123 MAIN ST BILLINGS, MT 59102
    if not s:
        return False
    return bool(re.search(r",\s*MT\s*\d{5}(?:-\d{4})?$", s, re.I))


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