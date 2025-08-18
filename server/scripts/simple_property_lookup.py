#!/usr/bin/env python3
"""
Simple property lookup script using requests instead of Playwright
Fallback approach for environments where Playwright dependencies are not available
"""

import requests
import sys
import json
import re
from bs4 import BeautifulSoup
import time

BASE_URL = "https://svc.mt.gov/msl/cadastral/?page=PropertyDetails&geocode="

def get_property_address(geocode: str) -> dict:
    """
    Attempt to retrieve property address using requests + BeautifulSoup
    This is a simpler approach that may not work for all SPAs
    """
    try:
        full_url = BASE_URL + geocode
        
        # Set headers to mimic a real browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }
        
        # Make the request
        response = requests.get(full_url, headers=headers, timeout=30)
        response.raise_for_status()
        
        # Parse with BeautifulSoup
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Try to find address in the page content
        page_text = soup.get_text()
        
        # Look for address patterns in the text
        address_patterns = [
            r"Address:\s*([A-Z0-9 .#'-]+?,\s*MT\s*\d{5}(?:-\d{4})?)",
            r"Physical Address:\s*([A-Z0-9 .#'-]+?,\s*MT\s*\d{5}(?:-\d{4})?)",
            r"Property Address:\s*([A-Z0-9 .#'-]+?,\s*MT\s*\d{5}(?:-\d{4})?)",
        ]
        
        for pattern in address_patterns:
            match = re.search(pattern, page_text, flags=re.I)
            if match:
                address = " ".join(match.group(1).split())
                return {"success": True, "address": address, "geocode": geocode}
        
        # If no address found, try to find any Montana addresses
        mt_address_pattern = r"([A-Z0-9 .#'-]+?,\s*MT\s*\d{5}(?:-\d{4})?)"
        matches = re.findall(mt_address_pattern, page_text, flags=re.I)
        
        if matches:
            # Return the first valid-looking address
            for address in matches:
                cleaned_address = " ".join(address.split())
                if len(cleaned_address) > 10:  # Basic validation
                    return {"success": True, "address": cleaned_address, "geocode": geocode}
        
        # If still no address found, return info about the page
        return {
            "success": False, 
            "error": f"No address found for geocode {geocode}. The property may not exist or the page structure may have changed.",
            "debug_info": f"Page contains {len(page_text)} characters"
        }
        
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": f"Network error: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": f"Error processing geocode: {str(e)}"}

def _looks_like_full_address(s: str) -> bool:
    """Check if string looks like a complete Montana address"""
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