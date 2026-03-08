#!/usr/bin/env python3
"""Test templates endpoint in detail"""
import asyncio
import aiohttp
import json

API_BASE_URL = "http://api.metabob.local"
API_KEY = "c2Vzc2lvbnM6ZDFmYWU2MGMtM2Y5OS00NzBmLWE1ZGQtZGI5ZTMyOTU0OGY1OmJvb3RzdHJhcC1vcmc6Ym9vdHN0cmFwLXVzZXI="

async def get_templates():
    """Get all templates"""
    headers = {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json"
    }
    url = f"{API_BASE_URL}/v2/activities/templates"
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers) as resp:
            return resp.status, await resp.json()

async def main():
    print("Fetching templates from API...\n")
    
    status, data = await get_templates()
    print(f"Status: {status}")
    print(f"\nResponse structure:")
    print(json.dumps(data, indent=2)[:1000])
    
    if "templates" in data:
        templates = data["templates"]
        print(f"\nTotal templates: {len(templates)}")
        if len(templates) > 0:
            print(f"\nFirst template:")
            print(json.dumps(templates[0], indent=2)[:500])

if __name__ == "__main__":
    asyncio.run(main())
