#!/usr/bin/env python3
"""
Test script to verify the environment setup for deployment
"""
import sys
import os
import json

def test_environment():
    result = {
        "python_path": sys.executable,
        "python_version": sys.version,
        "working_directory": os.getcwd(),
        "environment_type": "deployment" if os.getenv("REPLIT_DEPLOYMENT") else "development",
        "playwright_available": False,
        "modules_available": {}
    }
    
    # Test module availability
    modules_to_test = ["playwright", "asyncio", "lxml", "bs4"]
    for module in modules_to_test:
        try:
            __import__(module)
            result["modules_available"][module] = True
        except ImportError:
            result["modules_available"][module] = False
    
    # Test Playwright specifically
    try:
        from playwright.sync_api import sync_playwright
        result["playwright_available"] = True
    except ImportError as e:
        result["playwright_error"] = str(e)
    
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    test_environment()