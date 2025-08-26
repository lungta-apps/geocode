# Diagnostic version to debug deployment issues
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeoutError
import re
import sys
import json
import subprocess

BASE_URL = "https://svc.mt.gov/msl/cadastral/?page=PropertyDetails&geocode="

def install_browsers_if_needed():
    """Install Playwright browsers if they're not available."""
    try:
        with sync_playwright() as p:
            p.chromium.launch(headless=True).close()
    except Exception as e:
        if "Executable doesn't exist" in str(e) or "download new browsers" in str(e):
            subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], 
                         check=True, capture_output=True, text=True)

def get_property_address_diagnostic(geocode: str) -> dict:
    install_browsers_if_needed()
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Set a longer timeout for deployment environment
        page.set_default_timeout(30000)

        try:
            full_url = BASE_URL + geocode
            print(f"Navigating to: {full_url}", file=sys.stderr)
            
            response = page.goto(full_url, wait_until="networkidle", timeout=30000)
            if response:
                print(f"Response status: {response.status}", file=sys.stderr)
            else:
                print("No response received", file=sys.stderr)
            
            # Wait longer for the page to load
            page.wait_for_timeout(5000)
            
            # Get page title for debugging
            title = page.title()
            print(f"Page title: {title}", file=sys.stderr)
            
            # Check if we can find the geocode on the page
            page_text = page.inner_text("body")
            if geocode in page_text:
                print("Geocode found on page", file=sys.stderr)
            else:
                print("Geocode NOT found on page", file=sys.stderr)
                # Return some page content for debugging
                return {
                    "success": False, 
                    "error": "Geocode not found on page",
                    "debug_info": {
                        "title": title,
                        "url": full_url,
                        "page_snippet": page_text[:500] if page_text else "No page text"
                    }
                }
            
            # Look for address with more relaxed pattern
            address_patterns = [
                r"Address:\s*([^,\n]+,\s*MT\s*\d{5}(?:-\d{4})?)",
                r"([A-Z0-9 .#'-]+?,\s*MT\s*\d{5}(?:-\d{4})?)",
            ]
            
            for pattern in address_patterns:
                matches = re.findall(pattern, page_text, flags=re.I | re.MULTILINE)
                if matches:
                    address = " ".join(matches[0].split())
                    print(f"Found address: {address}", file=sys.stderr)
                    return {"success": True, "address": address, "geocode": geocode}
            
            # If no address found, return debug info
            return {
                "success": False,
                "error": "Address pattern not found",
                "debug_info": {
                    "title": title,
                    "url": full_url,
                    "page_snippet": page_text[:1000] if page_text else "No page text"
                }
            }
            
        except Exception as e:
            return {
                "success": False, 
                "error": f"Error: {str(e)}",
                "debug_info": {"exception_type": type(e).__name__}
            }
        finally:
            browser.close()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"success": False, "error": "Geocode argument required"}))
        sys.exit(1)
    
    geocode = sys.argv[1].strip()
    result = get_property_address_diagnostic(geocode)
    print(json.dumps(result))