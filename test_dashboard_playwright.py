#!/usr/bin/env python3
from playwright.sync_api import sync_playwright
import sys

def test_dashboard():
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        
        # Create page with custom Host header
        page = context.new_page()
        
        # Set extra HTTP headers
        page.set_extra_http_headers({"Host": "dashboard.minibob.local"})
        
        # Navigate to dashboard via ingress
        print("Navigating to dashboard...")
        page.goto("http://localhost:80/", wait_until="domcontentloaded", timeout=30000)
        
        # Wait a bit for content to load
        page.wait_for_timeout(2000)
        
        # Get page title
        title = page.title()
        print(f"Page title: {title}")
        
        # Take screenshot
        page.screenshot(path="dashboard-screenshot.png", full_page=True)
        print("Screenshot saved to dashboard-screenshot.png")
        
        # Get some content
        content = page.content()
        print(f"Page content length: {len(content)}")
        print("First 500 chars:", content[:500])
        
        browser.close()

if __name__ == "__main__":
    try:
        test_dashboard()
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
