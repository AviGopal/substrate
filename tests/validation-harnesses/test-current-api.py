#!/usr/bin/env python3
"""Quick test of current API state"""
import asyncio
import aiohttp

API_BASE_URL = "http://api.metabob.local"
API_KEY = "c2Vzc2lvbnM6ZDFmYWU2MGMtM2Y5OS00NzBmLWE1ZGQtZGI5ZTMyOTU0OGY1OmJvb3RzdHJhcC1vcmc6Ym9vdHN0cmFwLXVzZXI="

async def test_endpoint(path: str, method: str = "GET"):
    """Test a single endpoint"""
    headers = {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json"
    }
    url = f"{API_BASE_URL}{path}"
    
    try:
        async with aiohttp.ClientSession() as session:
            if method == "GET":
                async with session.get(url, headers=headers) as resp:
                    status = resp.status
                    try:
                        data = await resp.json()
                    except:
                        data = await resp.text()
                    return status, data
    except Exception as e:
        return None, str(e)

async def main():
    print("Testing current API endpoints...\n")
    
    endpoints = [
        "/health",
        "/v2/activities",
        "/v2/activity-templates",
        "/v2/impulses",
        "/v2/boredom-activities",
    ]
    
    for endpoint in endpoints:
        print(f"Testing {endpoint}...", end=" ")
        status, data = await test_endpoint(endpoint)
        if status:
            print(f"✅ {status}")
            if status == 200 and isinstance(data, dict):
                print(f"  Keys: {list(data.keys())[:5]}")
        else:
            print(f"❌ {data}")
        print()

if __name__ == "__main__":
    asyncio.run(main())
